// Simplified HTTP client for the escrow MCP server.
//
// Known gap (parked): escrow-mcp-server only speaks stdio, so this endpoint
// does not exist yet. Reconnecting the two means either adding a Streamable
// HTTP transport to the server or switching this client to the MCP SDK.

interface McpCallResult {
  content: Array<{ type: string; text: string }>
}

export async function callMcp(tool: string, params: Record<string, unknown>): Promise<unknown> {
  const base = process.env.MCP_BASE_URL ?? "http://localhost:3100"
  const res = await fetch(`${base}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`MCP error ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as McpCallResult
  const first = data.content[0]
  if (!first) throw new Error(`MCP tool ${tool} returned no content`)
  return JSON.parse(first.text)
}
