// Connects to an MCP server the way a hosted agent will (Streamable HTTP) and lists its tools.
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpToolRecord } from "../db/schema.js"

export interface DiscoveryOptions {
  bearerToken?: string
  /** Allow loopback and private addresses. On in development, off in production (SSRF). */
  allowPrivateHosts: boolean
  timeoutMs?: number
}

export type DiscoverTools = (url: string, options: DiscoveryOptions) => Promise<McpToolRecord[]>

export class DiscoveryError extends Error {}

const MAX_TOOLS = 500

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number)
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  const v6 = address.toLowerCase()
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7))
  return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  if (addresses.some(isPrivateAddress)) {
    throw new DiscoveryError(`${url.hostname} resolves to a private address, which is not allowed`)
  }
}

export const discoverTools: DiscoverTools = async (rawUrl, options) => {
  const url = new URL(rawUrl)
  if (!options.allowPrivateHosts) await assertPublicHost(url)

  const headers: Record<string, string> = {}
  if (options.bearerToken) headers.Authorization = `Bearer ${options.bearerToken}`
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } })
  const client = new Client({ name: "clasp-discovery", version: "0.1.0" })
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000)

  try {
    await client.connect(transport, { signal })
    const tools: McpToolRecord[] = []
    let cursor: string | undefined
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { signal })
      for (const tool of page.tools) {
        tools.push({
          name: tool.name,
          ...(tool.title ? { title: tool.title } : {}),
          description: tool.description ?? "",
          inputSchema: tool.inputSchema as Record<string, unknown>,
        })
      }
      cursor = page.nextCursor
    } while (cursor && tools.length < MAX_TOOLS)
    return tools
  } catch (error) {
    if (error instanceof DiscoveryError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new DiscoveryError(`Could not list tools from ${url.host}: ${message}`)
  } finally {
    await client.close().catch(() => undefined)
  }
}
