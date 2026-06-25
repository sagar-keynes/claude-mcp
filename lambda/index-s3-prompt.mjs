// /**
//  * AWS Lambda Handler — Keynes AI Analytics Chatbot
//  *
//  * Streaming endpoint  : POST /api/query/stream  → uses awslambda.streamifyResponse
//  * Health endpoint     : GET  /health             → standard JSON response
//  *
//  * Deploy with Lambda Function URL (InvokeMode: RESPONSE_STREAM) or
//  * API Gateway with /response-streaming-invocations integration.
//  *
//  * Required env vars:
//  *   ANTHROPIC_API_KEY   — Anthropic API key
//  *   HOSTED_MCP_URL      — SSE endpoint for your Keynes AI MCP server
//  */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
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
const MAX_TOOL_STEPS = Number(process.env.MAX_TOOL_STEPS || 20)
const SYSTEM_PROMPT_BUCKET = process.env.SYSTEM_PROMPT_BUCKET || "kortex-creatives-config"
const SYSTEM_PROMPT_FILE_KEY = process.env.SYSTEM_PROMPT_FILE_KEY || "claude-mcp-system-prompt.md"

const secretsManagerClient = new SecretsManagerClient({ region: REGION })
const s3Client = new S3Client({ region: REGION })
let secretsCache = {}

/**
 * Fetches the system prompt file from S3.
 */
async function getSpecCheckRequirementsFromS3(bucketName, key) {
  try {
    console.log(`Fetching system prompt.`)
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
    const response = await s3Client.send(command)
    
    console.log(`System prompt fetch success.`)
    // Read the streaming body and decode as UTF-8
    const fileContent = await response.Body.transformToString('utf-8')
    console.log(`System prompt returned.`)
    return fileContent
  } catch (error) {
    console.error(`Error fetching file from S3: ${error.message}`)
    throw new Error(`Failed to fetch from S3: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Tool definitions (unchanged from Express version)
// ---------------------------------------------------------------------------

const chartDisplayTool = tool({
  description:
    'Render a line, bar, or scatter chart inline in the chat. Use when the user asks for a chart, graph, or visualization of data.',
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
    // 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
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
 * The ": padding\n\n" SSE comment is invisible to clients but satisfies
 * Lambda's ~8KB buffer threshold.
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
// MCP client factory (created fresh per invocation — avoids stale SSE connections)
// ---------------------------------------------------------------------------

async function createHostedMCPClient() {
  if (!HOSTED_MCP_URL) {
    throw new Error('HOSTED_MCP_URL environment variable is not configured')
  }
  return createMCPClient({
    transport: {
      type: 'sse',
      url: HOSTED_MCP_URL,
      // Add auth header here if needed:
      // headers: { Authorization: `Bearer ${process.env.MCP_API_KEY}` },
    },
  })
}

// ---------------------------------------------------------------------------
// Route: GET /health / OPTIONS — handled inline in handler export below
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Route: POST /api/query/stream  (STREAMING)
//
// IMPORTANT — this function must be invoked via awslambda.streamifyResponse.
// The outer export.handler detects the streaming path and delegates here.
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
  const { api_key } = await getSecretValue(ANTHROPIC_API_KEY_SECRET_NAME)
  const anthropic = createAnthropic({ apiKey: api_key })

  try {
    sseStream.write(ssePadding())

    mcpClient = await createHostedMCPClient()
    const mcpTools = await mcpClient.tools()
    const tools = { ...mcpTools, chartDisplayTool }

    if (!Object.keys(tools).length) {
      sseStream.write(`data: ${JSON.stringify({ type: 'error', errorText: 'No tools available from MCP' })}\n\n`)
      sseStream.write('data: [DONE]\n\n')
      sseStream.end()
      return
    }

    const SYSTEM_PROMPT = await getSpecCheckRequirementsFromS3(SYSTEM_PROMPT_BUCKET, SYSTEM_PROMPT_FILE_KEY)

    const result = streamText({
      model: anthropic('claude-opus-4-8'),
      system: SYSTEM_PROMPT,
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
// Router — resolves path + method from both API GW v1/v2 and Function URL events
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
//
// Lambda Function URL MUST use:
//   - Handler: handler  (this file's export below)
//   - Invoke mode: RESPONSE_STREAM
//
// Do NOT use a separate buffered handler — returning { statusCode, headers, body }
// from a response-streaming Function URL serializes that object as the HTTP body
// instead of streaming SSE to the client.
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
      s.write(JSON.stringify({ status: 'ok', hostedMcpConfigured: !!HOSTED_MCP_URL }))
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

// Backwards-compatible alias if AWS handler was configured as streamHandler
export { handler as streamHandler }