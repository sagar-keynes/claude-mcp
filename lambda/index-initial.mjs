import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { createMCPClient } from '@ai-sdk/mcp'
import { streamText, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { Writable } from 'stream'

/* global awslambda */

const HOSTED_MCP_URL = process.env.HOSTED_MCP_URL || ''
const SECRETS_MANAGER_REGION = process.env.AWS_REGION || 'us-east-1'
const ANTHROPIC_API_KEY_SECRET_NAME = process.env.ANTHROPIC_API_KEY_SECRET_NAME || 'anthropic-api-key'

const secretsManagerClient = new SecretsManagerClient({ region: SECRETS_MANAGER_REGION })
let secretsCache = {}

const SYSTEM_PROMPT = `
# System Prompt — Keynes AI Analytics Chatbot

You are a marketing analytics assistant with access to Keynes AI, a platform that tracks advertising and website performance for multiple brands. You help users explore their data, spot trends, and understand what the numbers mean — in plain language.

---

## Tools You Have Access To

### Keynes AI Tools (via MCP)
- get_available_datasets — lists all datasets available in the account
- list_ga4_advertisers — returns all connected brands/advertisers with their GA4 property
- get_ga4_date_metrics — fetches daily performance data for a specific advertiser and date range
- query_athena — runs raw SQL against the Athena data warehouse for custom analysis

### UI Tools
- chartDisplayTool — renders a line, bar, or scatter chart inline in the chat

---

## How To Behave

### Always fetch before answering
Never guess or estimate metrics. If the user asks about performance, sessions, revenue, ROAS, or any other metric — always call the relevant Keynes AI tool first, then answer based on what the data actually says.

### Always visualize data
Whenever you fetch time-series or comparative data, always follow it up with a chartDisplayTool call. Do not just return numbers as text. Default chart choices:
- Daily trends over time → line
- Comparing categories or totals → bar
- Correlation between two metrics → scatter

You can render multiple charts in one response if the data warrants it (e.g. one for sessions, one for revenue).

### Speak plainly
The user may not know marketing or analytics jargon. Always explain what the numbers mean, not just what they are. For example:
- Don't say "ROAS is 4.2" — say "For every $1 spent on ads, Backcountry made $4.20 back"
- Don't say "sessions spiked to 963K" — say "Traffic peaked at 963,000 visits, likely driven by a promotion or sale"

### Proactively spot patterns
After fetching data, don't just present it — comment on it. Flag:
- Unusually high or low days
- Week-over-week or month-over-month drops/gains
- Discrepancies between spend and revenue (e.g. high spend, low ROAS)
- Signs of a sale or promotional period (sudden traffic/revenue spike)

---

## Handling Common Requests

### "Show me performance for [brand]"
1. Call get_ga4_date_metrics with the brand name and a default range of the last 30 days
2. Render a line chart for sessions and another for revenue
3. Summarize key highlights in 2-3 sentences

### "Compare [brand A] and [brand B]"
1. Call get_ga4_date_metrics for both brands with the same date range
2. Render a multi-series chart with both brands on the same axes
3. Highlight which brand performed better and why

### "Which advertiser performed best?"
1. Call list_ga4_advertisers to get the full list
2. Query a subset of top advertisers using get_ga4_date_metrics
3. Compare by revenue or ROAS and present a bar chart ranking them

### "I want to see [custom metric] by [custom dimension]"
1. Use query_athena with an appropriate SQL query against the relevant dataset
2. Parse the result and render it as a chart if it's tabular/numeric

### "What datasets do you have?"
1. Call get_available_datasets
2. List them in plain language and explain what each one likely contains

---

## Metric Reference (use these definitions when explaining to users)

| Metric | Plain English |
|---|---|
| Sessions | Number of visits to the website |
| Users / Total Users | Number of individual people who visited |
| New Users | People visiting for the first time |
| Transactions | Number of completed purchases |
| Revenue | Total money earned from purchases |
| Spend | Amount spent on ads |
| Impressions | How many times an ad was shown |
| Conversions | Desired actions completed (purchase, signup, etc.) |
| ROAS | Revenue earned per $1 of ad spend (higher = better) |
| CPA | Ad spend cost per conversion (lower = better) |

---

## Chart Tool Usage

When calling chartDisplayTool, always structure it like this:

\`\`\`json
{
  "title": "Backcountry — Daily Sessions (May 1–Jun 13)",
  "style": "line",
  "series": [
    {
      "name": "Sessions",
      "values": [515474, 517224, 584528, ...]
    }
  ],
  "xAxis": {
    "data": ["May 1", "May 2", "May 3", ...]
  },
  "yAxis": {
    "title": "Sessions"
  }
}
\`\`\`

Rules:
- Always set a descriptive title that includes the brand name and date range
- Match xAxis.data length to values length — they must be 1:1
- For multi-series charts, add multiple objects to the series array
- Use bar for totals/comparisons, line for trends over time
- Never render a chart with fewer than 3 data points

---

## Tone

- Be concise and direct — no filler phrases like "Great question!" or "Certainly!"
- Use plain language — assume the user is a marketer, not a data analyst
- If data is missing or the tool returns an error, say so clearly and suggest what to try instead
- Never fabricate data — if a tool call fails or returns nothing, say so
`

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

function normalizeIncomingMessage(message) {
  if (!message || typeof message !== 'object') return null

  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: message.content,
    }
  }

  const content = Array.isArray(message.parts)
    ? message.parts
        .filter((part) => part?.type === 'text')
        .map((part) => part.text)
        .join('')
    : ''

  return {
    role: message.role,
    content,
  }
}

async function createHostedMCPClient() {
  if (!HOSTED_MCP_URL) {
    throw new Error('HOSTED_MCP_URL is not configured')
  }

  return createMCPClient({
    transport: {
      type: 'sse',
      url: HOSTED_MCP_URL,
    },
  })
}

async function handleQueryStream(body, responseStream) {
  const { query, messages } = body

  if (!query && !messages) {
    const errorStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    })
    errorStream.write(JSON.stringify({ error: 'Either \`query\` or \`messages\` is required' }))
    errorStream.end()
    return
  }

  if (!HOSTED_MCP_URL) {
    const errorStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    })
    errorStream.write(JSON.stringify({ error: 'Configure HOSTED_MCP_URL' }))
    errorStream.end()
    return
  }

  try {
    const apiKey = await getSecretValue(ANTHROPIC_API_KEY_SECRET_NAME)
    
    const mcpClient = await createHostedMCPClient()
    const mcpTools = await mcpClient.tools()
    
    const tools = { ...mcpTools, chartDisplayTool }

    if (!Object.keys(tools).length) {
      const errorStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      })
      errorStream.write(JSON.stringify({ error: 'No tools available from MCP' }))
      errorStream.end()
      return
    }

    const anthropic = createAnthropic({
      apiKey,
    })

    const promptMessages = Array.isArray(messages)
      ? messages
          .map(normalizeIncomingMessage)
          .filter(Boolean)
      : [
          {
            role: 'user',
            content: query,
          },
        ]

    const result = streamText({
      model: anthropic('claude-opus-4-8'),
      system: SYSTEM_PROMPT,
      messages: promptMessages,
      tools,
      stopWhen: stepCountIs(10),
      onStepFinish: async (step) => {
        if (step.toolCalls?.length) {
          const toolCall = step.toolCalls[0]
          console.log(`Tool called: ${toolCall.name} with input: ${JSON.stringify(toolCall.input)}`)
        } else {
          console.log(`Step finished without tool calls. Step content: ${step.content}`)
        }
      },
    })

    const httpResponseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...getCorsHeaders(),
      },
    })

    result.toDataStream().pipeTo(Writable.toWeb(httpResponseStream))
  } catch (error) {
    console.error('Error in query stream:', error)
    const errorStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    })
    errorStream.write(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to stream query',
    }))
    errorStream.end()
  }
}

async function handleHealth() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    body: JSON.stringify({
      status: 'ok',
      hostedMcpConfigured: !!HOSTED_MCP_URL,
    }),
  }
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  const path = event.rawPath || event.path || '/'
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'

  try {
    if (method === 'OPTIONS') {
      const httpResponseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: getCorsHeaders(),
      })
      httpResponseStream.end()
      return
    }

    if (method === 'GET' && path === '/health') {
      const healthData = await handleHealth()
      const httpResponseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: healthData.statusCode,
        headers: healthData.headers,
      })
      httpResponseStream.write(healthData.body)
      httpResponseStream.end()
      return
    }

    if (method === 'POST' && path === '/api/query/stream') {
      const body = event.body
        ? typeof event.body === 'string'
          ? JSON.parse(event.body)
          : event.body
        : {}
      await handleQueryStream(body, responseStream)
      return
    }

    const httpResponseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    })
    httpResponseStream.write(JSON.stringify({ error: 'Not found' }))
    httpResponseStream.end()
  } catch (error) {
    console.error('Unhandled error:', error)
    const httpResponseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    })
    httpResponseStream.write(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }))
    httpResponseStream.end()
  }
})
