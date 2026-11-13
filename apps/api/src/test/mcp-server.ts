// A real MCP server over Streamable HTTP for tests, with an optional bearer token and a tool list
// that a test can change to simulate a server that adds or drops tools.
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"

export interface TestMcpServer {
  url: string
  /** Tool names the server currently offers. */
  tools: string[]
  close(): Promise<void>
}

export async function startTestMcpServer(
  options: { token?: string; tools?: string[] } = {},
): Promise<TestMcpServer> {
  const state = { tools: options.tools ?? ["create_lead", "search_crm"] }

  const http: Server = createServer(async (req, res) => {
    if (options.token && req.headers.authorization !== `Bearer ${options.token}`) {
      res.writeHead(401).end("unauthorized")
      return
    }
    // Stateless mode: a fresh server and transport per request.
    const mcp = new McpServer({ name: "test-crm", version: "1.0.0" })
    for (const name of state.tools) {
      mcp.registerTool(
        name,
        {
          description: `Test tool ${name}`,
          inputSchema: { query: z.string().describe("What to look for") },
        },
        async ({ query }) => ({ content: [{ type: "text", text: `${name}: ${query}` }] }),
      )
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => {
      void transport.close()
      void mcp.close()
    })
    await mcp.connect(transport)
    await transport.handleRequest(req, res)
  })

  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve))
  const { port } = http.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    get tools() {
      return state.tools
    },
    set tools(next) {
      state.tools = next
    },
    close: () => new Promise((resolve) => http.close(() => resolve())),
  }
}
