// A small CRM, stubbed. Evals grade which tools the agent calls and with what arguments; the
// side-effecting tools (create_lead, send_email) never touch anything real.

export interface FixtureTool {
  name: string
  description: string
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] }
  /** Read-only tools may be called freely; side-effecting ones only when the user asked. */
  sideEffect: boolean
  run(input: Record<string, unknown>): string
}

export const DEALS: Record<
  string,
  { company: string; stage: string; amount: string; owner: string }
> = {
  "D-1042": { company: "Acme Corp", stage: "Negotiation", amount: "$48,000", owner: "Maria Rossi" },
  "D-1077": { company: "Globex", stage: "Discovery", amount: "$12,500", owner: "Tom Becker" },
  "D-1101": { company: "Initech", stage: "Closed won", amount: "$31,200", owner: "Maria Rossi" },
}

export const CRM_TOOLS: FixtureTool[] = [
  {
    name: "search_crm",
    description: "Search companies, contacts and deals in the CRM. Returns matching records.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Company, contact or deal to find" } },
      required: ["query"],
    },
    sideEffect: false,
    run: ({ query }) => {
      const q = String(query ?? "").toLowerCase()
      const hits = Object.entries(DEALS).filter(
        ([, d]) =>
          q.includes(d.company.toLowerCase().split(" ")[0] ?? "") ||
          d.company.toLowerCase().includes(q),
      )
      return hits.length === 0
        ? "No records found."
        : hits
            .map(
              ([id, d]) => `${id}: ${d.company}, stage ${d.stage}, ${d.amount}, owner ${d.owner}`,
            )
            .join("\n")
    },
  },
  {
    name: "get_deal",
    description: "Get one deal by its ID (for example D-1042).",
    input_schema: {
      type: "object",
      properties: { deal_id: { type: "string" } },
      required: ["deal_id"],
    },
    sideEffect: false,
    run: ({ deal_id }) => {
      const deal = DEALS[String(deal_id ?? "")]
      return deal ? JSON.stringify({ id: deal_id, ...deal }) : "Deal not found."
    },
  },
  {
    name: "create_lead",
    description: "Create a new lead in the CRM.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string" },
        contact_name: { type: "string" },
        country: { type: "string" },
      },
      required: ["company", "contact_name"],
    },
    sideEffect: true,
    run: ({ company }) => `Lead created for ${String(company)}.`,
  },
  {
    name: "send_email",
    description: "Send an email from the sales rep's mailbox.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
      required: ["to", "subject", "body"],
    },
    sideEffect: true,
    run: ({ to }) => `Email sent to ${String(to)}.`,
  },
]
