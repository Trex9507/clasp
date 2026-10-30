// Client HTTP verso il server MCP (chiamate JSON-RPC semplificate per fase 1).
// In produzione si usa @modelcontextprotocol/sdk con StdioClientTransport.

export interface McpCallResult {
  content: Array<{ type: string; text: string }>;
}

export async function callMcp(
  tool: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const base = process.env.MCP_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`MCP error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as McpCallResult;
  return JSON.parse(data.content[0].text);
}
