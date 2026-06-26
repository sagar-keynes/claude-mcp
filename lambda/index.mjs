// /**
//  * AWS Lambda Handler — Keynes AI Analytics Chatbot with Google Docs System Prompt
//  *
//  * Streaming endpoint  : POST /api/query/stream  → uses awslambda.streamifyResponse
//  * Health endpoint     : GET  /health             → standard JSON response
//  *
//  * Deploy with Lambda Function URL (InvokeMode: RESPONSE_STREAM) or
//  * API Gateway with /response-streaming-invocations integration.
//  *
//  * Required env vars:
//  *   ANTHROPIC_API_KEY_SECRET_NAME   — Secrets Manager secret name for API key
//  *   GOOGLE_DOCS_SECRET_NAME         — Secrets Manager secret name for Google service account
//  *   GOOGLE_DOC_ID                   — Google Doc ID to fetch system prompt from
//  *   HOSTED_MCP_URL                  — SSE endpoint for Keynes AI MCP server
//  */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { google } from 'googleapis'
import { createMCPClient } from '@ai-sdk/mcp'
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOSTED_MCP_URL = process.env.HOSTED_MCP_URL || ''
const REGION = process.env.AWS_REGION || 'us-east-1'
const ANTHROPIC_API_KEY_SECRET_NAME = process.env.ANTHROPIC_API_KEY_SECRET_NAME || 'Claude-api-key'
const GOOGLE_DOCS_SECRET_NAME = process.env.GOOGLE_DOCS_SECRET_NAME || 'google-service-account'
const GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID || ''
const MAX_TOOL_STEPS = Number(process.env.MAX_TOOL_STEPS || 20)

const secretsManagerClient = new SecretsManagerClient({ region: REGION })
let secretsCache = {}
let systemPromptCache = null

// ---------------------------------------------------------------------------
// Google Docs Integration
// ---------------------------------------------------------------------------

/**
 * Fetches the system prompt from a Google Doc using Service Account authentication.
 */
async function getSystemPromptFromGoogleDocs() {
  if (systemPromptCache) {
    return systemPromptCache
  }

  if (!GOOGLE_DOC_ID) {
    throw new Error('GOOGLE_DOC_ID environment variable is not configured')
  }

  try {
    console.log(`Fetching system prompt from Google Doc: ${GOOGLE_DOC_ID}`)

    // Retrieve service account credentials from Secrets Manager
    const serviceAccountJson = await getSecretValue(GOOGLE_DOCS_SECRET_NAME)
    const serviceAccount = typeof serviceAccountJson === 'string'
      ? JSON.parse(serviceAccountJson)
      : serviceAccountJson

    // Authenticate with Google using service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    })

    // Create Google Docs API client
    const docs = google.docs({ version: 'v1', auth })

    // Fetch the document
    const response = await docs.documents.get({
      documentId: GOOGLE_DOC_ID,
    })

    // Extract text content from the document
    const document = response.data
    let textContent = ''

    if (document.body && document.body.content) {
      for (const element of document.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          for (const el of element.paragraph.elements) {
            if (el.textRun) {
              textContent += el.textRun.content
            }
          }
        }
      }
    }

    console.log(`System prompt fetched successfully (${textContent.length} characters)`)
    systemPromptCache = textContent
    return textContent
  } catch (error) {
    console.error(`Error fetching system prompt from Google Docs: ${error.message}`)
    throw new Error(`Failed to fetch system prompt from Google Docs: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSecretValue(secretName) {
  if (secretsCache[secretName]) {
    return secretsCache[secretName]
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName })
    const response = await secretsManagerClient.send(command)

    let secretValue
    if (response.SecretString) {
      secretValue = response.SecretString
      try {
        const parsed = JSON.parse(secretValue)
        if (typeof parsed === 'object' && parsed !== null) {
          secretValue = parsed
        }
      } catch {
        // secretValue is a plain string, not JSON
      }
    } else if (response.SecretBinary) {
      secretValue = Buffer.from(response.SecretBinary).toString('utf-8')
    }

    secretsCache[secretName] = secretValue
    return secretValue
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error)
    throw new Error(`Failed to retrieve secret: ${error.message}`)
  }
}

/**
 * Parse the Lambda event body safely.
 * Handles both string (API Gateway) and object (Function URL parsed) bodies.
 */
function parseBody(event) {
  try {
    if (!event.body) return {}
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  } catch {
    return {}
  }
}

/**
 * Build CORS + content-type headers shared by all responses.
 */
function baseHeaders(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }
}

function uiMessageStreamHeaders() {
  return {
    ...baseHeaders('text/event-stream'),
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'x-vercel-ai-ui-message-stream': 'v1',
  }
}

/**
 * Write a well-formed SSE comment padding block.
 * Lambda buffers small chunks; padding forces a flush.
 */
function ssePadding(size = 8192) {
  return `: ${'x'.repeat(size)}\n\n`
}

async function resolvePromptMessages(body) {
  const { query, messages } = body

  if (Array.isArray(messages) && messages.length) {
    return convertToModelMessages(messages)
  }

  if (query) {
    return [{ role: 'user', content: query }]
  }

  return null
}

async function pipeUIMessageStreamToLambda(sseStream, result) {
  for await (const chunk of result.toUIMessageStream()) {
    sseStream.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }
  sseStream.write('data: [DONE]\n\n')
}

// ---------------------------------------------------------------------------
// Chart formatting helpers
// ---------------------------------------------------------------------------

function detectChartableData(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null

  const headers = rows[0]
  if (!Array.isArray(headers) || headers.length < 2) return null

  // Check if first column looks like a date or category label
  const firstColName = String(headers[0]).toLowerCase()
  const isDateColumn = /date|time|month|year|period/.test(firstColName)

  // Find numeric columns
  const numericColumns = []
  for (let i = 1; i < headers.length; i++) {
    const colName = headers[i]
    const isNumeric = rows.slice(1).every(row => {
      const val = row[i]
      return val == null || !isNaN(parseFloat(val))
    })
    if (isNumeric) {
      numericColumns.push({ index: i, name: String(colName) })
    }
  }

  if (!numericColumns.length) return null

  // Build chart data
  const xData = rows.slice(1).map(row => String(row[0]))
  const series = numericColumns.map(({ index, name }) => ({
    name,
    values: rows.slice(1).map(row => parseFloat(row[index]) || 0),
  }))

  return {
    xData,
    series,
    isTimeSeriesLike: isDateColumn,
    firstColName: String(headers[0]),
    style: isDateColumn ? 'line' : 'bar',
  }
}

function generateChartFromQueryResult(queryResult, userQuery = '') {
  const rows = queryResult?.rows
  if (!rows) return null

  const chartData = detectChartableData(rows)
  if (!chartData) return null

  // Infer title from context
  let title = 'Data Visualization'
  if (userQuery) {
    const match = userQuery.match(/(?:daily|monthly|weekly)?\s*(\w+(?:\s+\w+)?)/i)
    if (match) title = `${match[1].trim()} Over Time`
  }

  return {
    title,
    style: chartData.style,
    series: chartData.series,
    xAxis: {
      data: chartData.xData,
      title: chartData.firstColName,
    },
    yAxis: {
      title: chartData.series.length === 1 ? chartData.series[0].name : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const chartDisplayTool = tool({
  description:
    'Render a line, bar, or scatter chart inline in the chat. Use when the user asks for a chart, graph, or visualization of data, or when you receive tabular time-series data from a query.',
  inputSchema: z.object({
    title: z.string().describe('Chart heading'),
    style: z.enum(['line', 'bar', 'scatter']).describe('Chart type'),
    series: z
      .array(
        z.object({
          name: z.string().describe('Series label shown in legend'),
          values: z.array(z.number()).describe('Array of numeric data points'),
        }),
      )
      .describe('One or more data series to plot'),
    xAxis: z
      .object({
        data: z.array(z.string()).describe('Labels for each point on the x-axis'),
        title: z.string().optional().describe('X-axis label'),
      })
      .optional(),
    yAxis: z
      .object({
        title: z.string().optional().describe('Y-axis label'),
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
  }),
  execute: async (input) => input,
})

// ---------------------------------------------------------------------------
// MCP client factory
// ---------------------------------------------------------------------------

async function createHostedMCPClient() {
  if (!HOSTED_MCP_URL) {
    throw new Error('HOSTED_MCP_URL environment variable is not configured')
  }
  return createMCPClient({
    transport: {
      type: 'sse',
      url: HOSTED_MCP_URL,
    },
  })
}

// ---------------------------------------------------------------------------
// Route: POST /api/query/stream (STREAMING)
// ---------------------------------------------------------------------------

async function handleStream(event, responseStream) {
  const body = parseBody(event)
  const promptMessages = await resolvePromptMessages(body)

  if (!promptMessages?.length) {
    const errStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: baseHeaders(),
    })
    errStream.write(JSON.stringify({ error: 'Either query or messages is required' }))
    errStream.end()
    return
  }

  if (!HOSTED_MCP_URL) {
    const errStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 500,
      headers: baseHeaders(),
    })
    errStream.write(JSON.stringify({ error: 'HOSTED_MCP_URL is not configured' }))
    errStream.end()
    return
  }

  const sseStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: uiMessageStreamHeaders(),
  })

  let mcpClient = null
  try {
    sseStream.write(ssePadding())

    // Fetch API key from Secrets Manager
    const apiKeySecret = await getSecretValue(ANTHROPIC_API_KEY_SECRET_NAME)
    const apiKey = typeof apiKeySecret === 'object' ? apiKeySecret.api_key : apiKeySecret
    const anthropic = createAnthropic({ apiKey })

    // Fetch system prompt from Google Docs
    const systemPrompt = await getSystemPromptFromGoogleDocs()

    mcpClient = await createHostedMCPClient()
    const mcpTools = await mcpClient.tools()
    const tools = { ...mcpTools, chartDisplayTool }

    if (!Object.keys(tools).length) {
      sseStream.write(`data: ${JSON.stringify({ type: 'error', errorText: 'No tools available from MCP' })}\n\n`)
      sseStream.write('data: [DONE]\n\n')
      sseStream.end()
      return
    }

    // Enhance system prompt with chart generation guidance
    const enhancedSystemPrompt = `${systemPrompt}

## Visualization Guidelines

When you receive tabular query results containing:
- Date/time columns with numerical metrics (daily spend, revenue, impressions, etc.)
- Multiple time periods with comparable values

Use the \`chartDisplayTool\` to create a visual representation. Choose:
- **line chart** for trends over time (especially continuous metrics like spend, revenue)
- **bar chart** for comparing discrete periods or categories
- **scatter chart** for relationship analysis

After generating the chart, provide your analysis of the data patterns, trends, and insights.

**Example**: If a query returns daily ad spend for May with 31 rows, immediately create a line chart showing the spend trend, then analyze patterns (peaks, drops, anomalies).`

    const result = streamText({
      model: anthropic('claude-opus-4-8'),
      system: enhancedSystemPrompt,
      messages: promptMessages,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      onStepFinish: (step) => {
        if (step.toolCalls?.length) {
          const tc = step.toolCalls[0]
          console.log(`Tool called: ${tc.name} — input: ${JSON.stringify(tc.input)}`)
        } else {
          console.log('Step finished (no tool calls)')
        }
      },
    })

    await pipeUIMessageStreamToLambda(sseStream, result)
    sseStream.end()
  } catch (err) {
    console.error('Stream handler error:', err)
    try {
      sseStream.write(`data: ${JSON.stringify({ type: 'error', errorText: err.message || 'Stream failed' })}\n\n`)
      sseStream.write('data: [DONE]\n\n')
      sseStream.end()
    } catch {
      // stream already closed
    }
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close()
      } catch (closeErr) {
        console.error('MCP client close error:', closeErr)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function getPathAndMethod(event) {
  if (event.requestContext?.http) {
    return {
      path: event.requestContext.http.path || event.rawPath || '/',
      method: (event.requestContext.http.method || 'GET').toUpperCase(),
    }
  }
  return {
    path: event.path || event.rawPath || '/',
    method: (event.httpMethod || 'GET').toUpperCase(),
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    const { path, method } = getPathAndMethod(event)

    if (method === 'OPTIONS') {
      const s = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 204,
        headers: baseHeaders(),
      })
      s.end()
      return
    }

    if (method === 'GET' && path === '/health') {
      const s = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: baseHeaders(),
      })
      s.write(JSON.stringify({ status: 'ok', hostedMcpConfigured: !!HOSTED_MCP_URL, googleDocsConfigured: !!GOOGLE_DOC_ID }))
      s.end()
      return
    }

    if (method === 'POST' && path === '/api/query/stream') {
      await handleStream(event, responseStream)
      return
    }

    const s = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 404,
      headers: baseHeaders(),
    })
    s.write(JSON.stringify({ error: 'Not found' }))
    s.end()
  },
)

export { handler as streamHandler }
