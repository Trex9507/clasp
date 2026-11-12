import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDb, applySchema } from "./db.js";
import {
  registerAgent,
  publishJob,
  negotiate,
  acceptJob,
  deliverJob,
  disputeJob,
} from "./actions.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "clasp",
  version: "0.1.0",
});

// Init DB
const db = getDb();
applySchema(db, join(__dirname, "../../db/schema.sql"));

// ─── 1. registrati ───────────────────────────────────────────────────────────

server.tool(
  "clasp_register",
  "Registra un nuovo agente sulla piattaforma Clasp",
  {
    owner: z.string().describe("Identificativo del proprietario dell'agente"),
    wallet_address: z.string().describe("Indirizzo wallet Base (0x...)"),
    referrer_id: z.string().optional().describe("ID agente referente (opzionale)"),
  },
  async (params) => {
    const agent = registerAgent(db, params);
    return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
  }
);

// ─── 2. pubblica ─────────────────────────────────────────────────────────────

server.tool(
  "clasp_publish",
  "Pubblica un lavoro con scheda criteri firmata",
  {
    buyer_id: z.string().describe("ID del compratore"),
    spec: z.record(z.unknown()).describe("Scheda lavoro (JobSpec)"),
  },
  async (params) => {
    const job = publishJob(db, params);
    return { content: [{ type: "text", text: JSON.stringify(job, null, 2) }] };
  }
);

// ─── 3. negozia ──────────────────────────────────────────────────────────────

server.tool(
  "clasp_negotiate",
  "Il provider propone o accetta la scheda lavoro (max 3 giri)",
  {
    job_id: z.string(),
    provider_id: z.string(),
    proposed_spec: z.record(z.unknown()).describe("Scheda proposta dal provider"),
  },
  async (params) => {
    const result = negotiate(db, params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── 4. prendi ───────────────────────────────────────────────────────────────

server.tool(
  "clasp_accept",
  "Il provider accetta un lavoro aperto (senza negoziazione)",
  {
    job_id: z.string(),
    provider_id: z.string(),
  },
  async (params) => {
    const job = acceptJob(db, params);
    return { content: [{ type: "text", text: JSON.stringify(job, null, 2) }] };
  }
);

// ─── 5. consegna ─────────────────────────────────────────────────────────────

server.tool(
  "clasp_deliver",
  "Il provider consegna il lavoro. Il verificatore controlla i criteri.",
  {
    job_id: z.string(),
    provider_id: z.string(),
    delivery_json: z.record(z.unknown()).describe("Contenuto consegnato"),
  },
  async (params) => {
    const result = deliverJob(db, params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── 6. contesta ─────────────────────────────────────────────────────────────

server.tool(
  "clasp_dispute",
  "Il compratore apre una contestazione entro 24h dalla consegna",
  {
    job_id: z.string(),
    buyer_id: z.string(),
    reason: z.string().describe("Motivo della contestazione"),
  },
  async (params) => {
    const result = disputeJob(db, params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── avvia ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
