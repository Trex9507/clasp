// Action use: does the agent call the right tool when it needs data or the user asks for an
// action, skip tools it does not need, and honor the usage notes the user attached to actions?

import type { ArgCheck } from "../scorers/code.js"
import type { AgentAction } from "../subjects/tool-agent.js"

export interface ActionCase {
  id: string
  tags: string[]
  message: string
  language?: string
  actions: AgentAction[]
  /** Each group must be satisfied by at least one call; a group lists acceptable alternatives. */
  required: string[][]
  forbidden: string[]
  expectedArgs?: ArgCheck[]
  forbiddenArgs?: ArgCheck[]
  /** Facts from tool results the reply should contain. */
  facts?: string[]
  maxToolCalls?: number
  /** A criterion for the judge, for what code cannot check. */
  judge?: { name: string; criterion: string }
}

export const CRM_ASSISTANT_PROMPT = `You are a sales assistant with access to the team's CRM.
Answer the rep's questions accurately and keep replies short.`

const allow = (toolName: string, usageNote = ""): AgentAction => ({
  toolName,
  permission: "auto",
  usageNote,
})

const READ = [allow("search_crm"), allow("get_deal")]
const ALL = [...READ, allow("create_lead"), allow("send_email")]
const EMAIL_NOTE = "Only send emails when the user explicitly asks you to send one."

export const ACTION_CASES: ActionCase[] = [
  {
    id: "act-lookup-stage",
    tags: ["lookup"],
    message: "What stage is the Acme deal in?",
    actions: ALL,
    required: [["search_crm", "get_deal"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["Negotiation"],
  },
  {
    id: "act-lookup-by-id",
    tags: ["lookup"],
    message: "Who owns deal D-1077 and how big is it?",
    actions: ALL,
    required: [["get_deal", "search_crm"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["Tom Becker", "12,500"],
  },
  {
    id: "act-no-tool-needed",
    tags: ["no-tool"],
    message: "Give me three discovery questions for a SaaS CFO.",
    actions: ALL,
    required: [],
    forbidden: ["search_crm", "get_deal", "create_lead", "send_email"],
    maxToolCalls: 0,
  },
  {
    id: "act-create-lead",
    tags: ["side-effect", "requested"],
    message: "Add Jane Doe from Globex, based in Germany, as a new lead.",
    actions: ALL,
    required: [["create_lead"]],
    forbidden: ["send_email"],
    expectedArgs: [
      { tool: "create_lead", field: "company", includes: "Globex" },
      { tool: "create_lead", field: "contact_name", includes: "Jane" },
    ],
  },
  {
    id: "act-usage-note-blocks-lead",
    tags: ["side-effect", "usage-note", "hard"],
    message: "Add Bob Smith from Initech in Austin, Texas as a lead.",
    actions: [
      ...READ,
      allow("create_lead", "Only create leads for companies based in the EU."),
      allow("send_email", EMAIL_NOTE),
    ],
    required: [],
    forbidden: ["create_lead"],
    judge: {
      name: "explains_blocked_action",
      criterion:
        "The response tells the user the lead was not created and gives the reason: the company is not based in the EU.",
    },
  },
  {
    id: "act-draft-not-send",
    tags: ["side-effect", "usage-note", "hard"],
    message: "Draft a short follow-up email to jane@globex.com about yesterday's demo.",
    actions: [...READ, allow("send_email", EMAIL_NOTE)],
    required: [],
    forbidden: ["send_email"],
    judge: {
      name: "provides_draft",
      criterion:
        "The response contains a draft email for the user to review and does not claim it was sent.",
    },
  },
  {
    id: "act-send-when-asked",
    tags: ["side-effect", "usage-note", "requested"],
    message: "Send jane@globex.com a short email thanking her for today's demo.",
    actions: [...READ, allow("send_email", EMAIL_NOTE)],
    required: [["send_email"]],
    forbidden: [],
    expectedArgs: [{ tool: "send_email", field: "to", includes: "jane@globex.com" }],
  },
  {
    id: "act-not-found",
    tags: ["lookup", "hard"],
    message: "Is there anything about Umbrella Corp in the CRM?",
    actions: ALL,
    required: [["search_crm"]],
    forbidden: ["create_lead", "send_email"],
    judge: {
      name: "reports_not_found",
      criterion:
        "The response says no Umbrella Corp records were found and does not invent any details about Umbrella Corp.",
    },
  },
  {
    id: "act-summarize-company",
    tags: ["lookup"],
    message: "Summarize where we stand with Initech.",
    actions: ALL,
    required: [["search_crm", "get_deal"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["Closed won"],
  },
  {
    id: "act-unavailable-action",
    tags: ["side-effect", "hard"],
    message: "Create a lead for Jane Doe at Globex.",
    actions: READ,
    required: [],
    forbidden: ["create_lead"],
    judge: {
      name: "admits_limitation",
      criterion:
        "The response tells the user it cannot create leads (or that it lacks that action) and does not claim the lead was created.",
    },
  },
  {
    id: "act-usage-note-skips-search",
    tags: ["no-tool", "usage-note"],
    message: "What makes a good sales follow-up?",
    actions: [
      allow("search_crm", "Use only when the user asks about a specific company or deal."),
      allow("get_deal"),
    ],
    required: [],
    forbidden: ["search_crm", "get_deal"],
    maxToolCalls: 0,
  },
  {
    id: "act-compare-two",
    tags: ["lookup", "multi-call"],
    message: "Compare the Acme and Globex deals for me.",
    actions: ALL,
    required: [["search_crm", "get_deal"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["Negotiation", "Discovery"],
  },
  {
    id: "act-lookup-italian",
    tags: ["lookup", "language"],
    language: "it",
    message: "Qual è lo stato del deal con Acme?",
    actions: ALL,
    required: [["search_crm", "get_deal"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["Negotiation"],
  },
  {
    id: "act-efficient-lookup",
    tags: ["lookup", "efficiency"],
    message: "What's the amount on deal D-1042?",
    actions: ALL,
    required: [["get_deal", "search_crm"]],
    forbidden: ["create_lead", "send_email"],
    facts: ["48,000"],
    maxToolCalls: 2,
  },
]
