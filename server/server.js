import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { createMCPClient } from '@ai-sdk/mcp'
import { streamText, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const HOSTED_MCP_URL = process.env.HOSTED_MCP_URL || ''
const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || ''

const ALLOWED_ATHENA_TABLES = [
  'client_reporting_date_dataset',
  'client_reporting_geo_dataset',
  'client_reporting_network_dataset_myreports',
  'client_reporting_hour_dataset',
]

const ATHENA_TABLE_SCHEMA = z.enum(ALLOWED_ATHENA_TABLES)

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION,
})

const SYSTEM_PROMPT = `You are Athena, an AI assistant that answers questions about Kortex analytics data stored in Athena.
be concise and to the point.
Use tool results to answer the user's question with clear, data-backed insights.
When the user asks for a chart, graph, or visualization, use the chartDisplayTool to render it inline after fetching the data.`

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
})

function toActionGroupParameters(params) {
  return Object.entries(params).map(([name, value]) => ({
    name,
    type: 'string',
    value: String(value),
  }))
}

function toActionGroupRequestBody(body) {
  return {
    content: {
      'application/json': {
        properties: toActionGroupParameters(body),
      },
    },
  }
}

function buildActionGroupEvent(apiPath, { httpMethod = 'GET', parameters = [], requestBody } = {}) {
  return {
    messageVersion: '1.0',
    apiPath,
    httpMethod,
    parameters,
    ...(requestBody ? { requestBody } : {}),
  }
}

function parseLambdaPayload(payload) {
  if (payload?.response?.responseBody?.['application/json']?.body) {
    const body = payload.response.responseBody['application/json'].body
    return typeof body === 'string' ? JSON.parse(body) : body
  }

  if (typeof payload?.body === 'string') {
    return JSON.parse(payload.body)
  }

  return payload
}

async function invokeActionGroup(event) {
  if (!LAMBDA_FUNCTION_NAME) {
    throw new Error('LAMBDA_FUNCTION_NAME is not configured')
  }

  const command = new InvokeCommand({
    FunctionName: LAMBDA_FUNCTION_NAME,
    Payload: Buffer.from(JSON.stringify(event)),
  })

  const response = await lambdaClient.send(command)

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null

    return {
      success: false,
      error: errorPayload?.errorMessage ?? response.FunctionError,
      apiPath: event.apiPath,
    }
  }

  if (!response.Payload) {
    return {
      success: false,
      error: 'Lambda returned an empty payload',
      apiPath: event.apiPath,
    }
  }

  const payload = JSON.parse(Buffer.from(response.Payload).toString())
  const httpStatusCode = payload?.response?.httpStatusCode

  if (httpStatusCode && httpStatusCode >= 400) {
    const errorBody = parseLambdaPayload(payload)
    return {
      success: false,
      error: errorBody?.error ?? errorBody?.message ?? 'Lambda action failed',
      status: httpStatusCode,
      apiPath: event.apiPath,
    }
  }

  return parseLambdaPayload(payload)
}

async function callActionGroup(apiPath, { httpMethod = 'GET', parameters = [], body } = {}) {
  const event = buildActionGroupEvent(apiPath, {
    httpMethod,
    parameters,
    requestBody: body ? toActionGroupRequestBody(body) : undefined,
  })

  return invokeActionGroup(event)
}

function createLambdaTools() {
  if (!LAMBDA_FUNCTION_NAME) {
    return {}
  }

  return {
    get_current_date: tool({
      description:
        "Get today's date and pre-computed common date ranges. Returns today's real date and pre-computed ranges for this_month, last_month (same-period matched), this_week, last_week, last_7_days, last_30_days. ALWAYS call this first when the user uses any relative date term.",
      inputSchema: z.object({}),
      execute: async () => callActionGroup('/get_current_date', { httpMethod: 'GET' }),
    }),

    query_athena: tool({
      description:
        'Execute a SQL query against an allowed Athena table. Returns success, table_name, sql_executed, row_count, columns[], rows[], and query_execution_id. The SQL must be SELECT-only and include a WHERE date BETWEEN DATE ... AND DATE ... filter.',
      inputSchema: z.object({
        table_name: ATHENA_TABLE_SCHEMA.describe(
          'One of client_reporting_date_dataset, client_reporting_geo_dataset, client_reporting_network_dataset_myreports, client_reporting_hour_dataset',
        ),
        sql_query: z
          .string()
          .describe(
            "A SELECT-only SQL query. Must include a WHERE date BETWEEN DATE '...' AND DATE '...' filter.",
          ),
        date_range_start: z.string().describe('Date range start in YYYY-MM-DD format'),
        date_range_end: z.string().describe('Date range end in YYYY-MM-DD format'),
      }),
      execute: async (input) =>
        callActionGroup('/query_athena', {
          httpMethod: 'POST',
          body: input,
        }),
    }),

    get_table_schema: tool({
      description:
        'Get schema for a specific Athena table. Returns column definitions and analytical notes for one of the four allowed tables. Use this to check column names before writing SQL.',
      inputSchema: z.object({
        table_name: ATHENA_TABLE_SCHEMA.describe('The table to describe'),
      }),
      execute: async ({ table_name }) =>
        callActionGroup('/get_table_schema', {
          httpMethod: 'GET',
          parameters: toActionGroupParameters({ table_name }),
        }),
    }),
  }
}

// Middleware
app.use(cors())
app.use(express.json())

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function createHostedMCPClient() {
  if (!HOSTED_MCP_URL) {
    throw new Error('HOSTED_MCP_URL is not configured')
  }

  return createMCPClient({
    transport: {
      type: 'sse',
      url: HOSTED_MCP_URL,
      // Add headers here when auth is needed:
      // headers: { Authorization: `Bearer ${process.env.MCP_API_KEY}` },
    },
  })
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

app.post('/api/query/stream', async (req, res) => {
  const { query, messages } = req.body

  if (!query && !messages) {
    return res.status(400).json({ error: 'Either `query` or `messages` is required' })
  }

  if (!HOSTED_MCP_URL && !LAMBDA_FUNCTION_NAME) {
    return res.status(500).json({ error: 'Configure HOSTED_MCP_URL and/or LAMBDA_FUNCTION_NAME' })
  }

  let mcpClient
  let mcpClientClosed = false

  const closeMcpClient = async () => {
    if (mcpClientClosed) return
    mcpClientClosed = true

    try {
      await mcpClient?.close()
    } catch (closeError) {
      console.error('Error closing MCP client:', closeError)
    }
  }

  res.once('close', () => {
    void closeMcpClient()
  })
  res.once('finish', () => {
    void closeMcpClient()
  })

  try {
    const mcpTools = HOSTED_MCP_URL
      ? await (async () => {
          mcpClient = await createHostedMCPClient()
          return mcpClient.tools()
        })()
      : {}

    const lambdaTools = createLambdaTools()
    const tools = { ...mcpTools, chartDisplayTool }

    if (!Object.keys(tools).length) {
      return res.status(500).json({ error: 'No tools available from MCP or Lambda' })
    }

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

    result.pipeUIMessageStreamToResponse(res)
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to stream query' })
    }
  }
})

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    hostedMcpConfigured: !!HOSTED_MCP_URL,
    lambdaConfigured: !!LAMBDA_FUNCTION_NAME,
  })
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})