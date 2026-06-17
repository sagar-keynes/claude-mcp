import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createMCPClient } from '@ai-sdk/mcp'
import { stepCountIs, streamText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

dotenv.config()

const app = express()

// config
const PORT = Number(process.env.PORT || 3000)
const HOSTED_MCP_URL = process.env.HOSTED_MCP_URL || ''
const STEP_COUNTS = Number(process.env.STEP_COUNTS || 10)

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

json
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
      // headers: { Authorization: Bearer ${process.env.MCP_API_KEY} },
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
    return res.status(400).json({ error: 'Either query or messages is required' })
  }

  if (!HOSTED_MCP_URL) {
    return res.status(500).json({ error: 'Configure HOSTED_MCP_URL' })
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
    mcpClient = await createHostedMCPClient()
    const mcpTools = await mcpClient.tools()
    const tools = { ...mcpTools, chartDisplayTool }

    if (!Object.keys(tools).length) {
      return res.status(500).json({ error: 'No tools available from MCP' })
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
      stopWhen: stepCountIs(STEP_COUNTS),
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
  })
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})