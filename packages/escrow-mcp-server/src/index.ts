import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { getDb, applySchema } from "./db.js"
import {
  registerAgent,
  publishJob,
  negotiate,
  acceptJob,
  deliverJob,
  disputeJob,
} from "./actions.js"

const server = new McpServer({ name: "clasp-escrow", version: "0.1.0" })

const db = getDb()
applySchema(db, process.env.SCHEMA_PATH)

function json(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
}

server.tool(
  "clasp_register",
  "Register a new agent on the Clasp escrow platform",
  {
    owner: z.string().describe("Identifier of the agent's owner"),
    wallet_address: z.string().describe("Base wallet address (0x...)"),
    referrer_id: z.string().optional().describe("ID of the referring agent (optional)"),
  },
  async (params) => json(registerAgent(db, params)),
)

server.tool(
  "clasp_publish",
  "Publish a job with a signed acceptance-criteria spec",
  {
    buyer_id: z.string().describe("ID of the buying agent"),
    spec: z.record(z.string(), z.unknown()).describe("Job spec (JobSpec)"),
  },
  async (params) => json(publishJob(db, params)),
)

server.tool(
  "clasp_negotiate",
  "The provider proposes or accepts the job spec (max 3 rounds)",
  {
    job_id: z.string(),
    provider_id: z.string(),
    proposed_spec: z.record(z.string(), z.unknown()).describe("Spec proposed by the provider"),
  },
  async (params) => json(negotiate(db, params)),
)

server.tool(
  "clasp_accept",
  "The provider accepts an open job as-is, without negotiation",
  { job_id: z.string(), provider_id: z.string() },
  async (params) => json(acceptJob(db, params)),
)

server.tool(
  "clasp_deliver",
  "The provider delivers the work; the verifier checks it against the spec",
  {
    job_id: z.string(),
    provider_id: z.string(),
    delivery_json: z.record(z.string(), z.unknown()).describe("Delivered content"),
  },
  async (params) => json(deliverJob(db, params)),
)

server.tool(
  "clasp_dispute",
  "The buyer opens a dispute within 24 hours of delivery",
  {
    job_id: z.string(),
    buyer_id: z.string(),
    reason: z.string().describe("Reason for the dispute"),
  },
  async (params) => json(disputeJob(db, params)),
)

await server.connect(new StdioServerTransport())
