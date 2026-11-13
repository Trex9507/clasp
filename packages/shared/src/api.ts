// Request and response contracts between apps/web and apps/api. The API validates and
// serializes with these schemas; the web app types its calls with the inferred types.
import { z } from "zod"
import { LANGUAGE_CODES } from "./languages.js"
import { MODEL_IDS } from "./models.js"

export const ErrorResponse = z.object({ detail: z.string() })
export type ErrorResponse = z.infer<typeof ErrorResponse>

export const WorkspaceKind = z.enum(["personal", "organization"])
export const WorkspaceRole = z.enum(["owner", "admin", "member"])

export const User = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
})
export type User = z.infer<typeof User>

export const Workspace = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: WorkspaceKind,
  role: WorkspaceRole,
})
export type Workspace = z.infer<typeof Workspace>

export const MeResponse = z.object({
  user: User,
  workspaces: z.array(Workspace),
})
export type MeResponse = z.infer<typeof MeResponse>

export const ModelOptionSchema = z.object({
  id: z.string(),
  provider: z.literal("anthropic"),
  providerModelId: z.string(),
  label: z.string(),
  description: z.string(),
})

export const ModelsResponse = z.object({
  models: z.array(ModelOptionSchema),
  defaultModelId: z.string(),
})
export type ModelsResponse = z.infer<typeof ModelsResponse>

export const WorkspaceParams = z.object({ workspaceId: z.uuid() })
export type WorkspaceParams = z.infer<typeof WorkspaceParams>

// --- Agents ----------------------------------------------------------------------------------

export const AgentStatus = z.enum(["active", "archived"])
export type AgentStatus = z.infer<typeof AgentStatus>

// "listed" (marketplace) is reserved in the database but not settable yet.
export const AgentVisibility = z.enum(["private", "workspace"])
export type AgentVisibility = z.infer<typeof AgentVisibility>

export const Effort = z.enum(["low", "medium", "high"])
export type Effort = z.infer<typeof Effort>

// --- Actions: tools from MCP connections that an agent may use --------------------------------

/** "auto" runs the tool without asking; "ask" pauses for the user's approval in the playground. */
export const ActionPermission = z.enum(["auto", "ask"])
export type ActionPermission = z.infer<typeof ActionPermission>

export const AgentAction = z.object({
  connectionId: z.uuid(),
  toolName: z.string().min(1).max(128),
  permission: ActionPermission.default("ask"),
  /** Optional guidance on when to use the action; added to the agent's instructions. */
  usageNote: z.string().trim().max(500).default(""),
})
export type AgentAction = z.infer<typeof AgentAction>

/** Everything that defines how an agent behaves. A change to any of it creates a new version. */
export const AgentConfig = z.object({
  model: z.enum(MODEL_IDS),
  language: z.enum(LANGUAGE_CODES),
  effort: Effort,
  systemPrompt: z.string().trim().min(1, "Write a system prompt").max(50_000),
  actions: z
    .array(AgentAction)
    .max(200)
    .default([])
    .refine(
      (actions) =>
        new Set(actions.map((a) => `${a.connectionId}/${a.toolName}`)).size === actions.length,
      "Each action can be added once",
    ),
})
export type AgentConfig = z.infer<typeof AgentConfig>
export type AgentConfigInput = z.input<typeof AgentConfig>

const AgentName = z.string().trim().min(1, "Give the agent a name").max(80)
const AgentDescription = z.string().trim().max(500)
const AgentIcon = z.string().trim().max(8)

export const CreateAgentRequest = z.object({
  name: AgentName,
  description: AgentDescription.default(""),
  icon: AgentIcon.default(""),
  visibility: AgentVisibility.default("private"),
  config: AgentConfig,
})
export type CreateAgentRequest = z.input<typeof CreateAgentRequest>

export const UpdateAgentRequest = z
  .object({
    name: AgentName,
    description: AgentDescription,
    icon: AgentIcon,
    visibility: AgentVisibility,
    config: AgentConfig,
  })
  .partial()
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>

export const AgentVersion = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  model: z.string(),
  language: z.string(),
  effort: Effort,
  systemPrompt: z.string(),
  actions: z.array(
    AgentAction.extend({
      connectionName: z.string(),
      /** The connection no longer offers this tool (or was removed); the action is skipped. */
      stale: z.boolean(),
    }),
  ),
  /** False when the runtime could not be updated yet; POST .../sync retries. */
  runtimeSynced: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: User,
})
export type AgentVersion = z.infer<typeof AgentVersion>

export const Agent = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  status: AgentStatus,
  visibility: AgentVisibility,
  currentVersion: AgentVersion,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type Agent = z.infer<typeof Agent>

export const AgentSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  status: AgentStatus,
  visibility: AgentVisibility,
  model: z.string(),
  language: z.string(),
  version: z.number().int().positive(),
  actionCount: z.number().int().nonnegative(),
  runtimeSynced: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type AgentSummary = z.infer<typeof AgentSummary>

export const AgentListQuery = z.object({ status: AgentStatus.default("active") })
export const AgentListResponse = z.object({ agents: z.array(AgentSummary) })
export type AgentListResponse = z.infer<typeof AgentListResponse>

export const AgentVersionsResponse = z.object({ versions: z.array(AgentVersion) })
export type AgentVersionsResponse = z.infer<typeof AgentVersionsResponse>

export const AgentParams = WorkspaceParams.extend({ agentId: z.uuid() })
export type AgentParams = z.infer<typeof AgentParams>

// --- MCP connections ---------------------------------------------------------------------------

export const McpAuthType = z.enum(["none", "bearer"])
export type McpAuthType = z.infer<typeof McpAuthType>

export const McpConnectionStatus = z.enum(["unchecked", "ok", "error"])
export type McpConnectionStatus = z.infer<typeof McpConnectionStatus>

export const McpTool = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
})
export type McpTool = z.infer<typeof McpTool>

const McpUrl = z.url({ protocol: /^https?$/, error: "Enter an http(s) URL" }).max(2048)

// Request schemas carry the secret inbound; responses never do (tests/guards/no-secret-in-response).
export const CreateMcpConnectionRequest = z
  .object({
    name: z.string().trim().min(1, "Name the connection").max(80),
    url: McpUrl,
    authType: McpAuthType.default("none"),
    bearerToken: z.string().trim().min(1).max(8192).optional(),
  })
  .refine((c) => c.authType === "none" || c.bearerToken, {
    message: "Paste the bearer token",
    path: ["bearerToken"],
  })
export type CreateMcpConnectionRequest = z.input<typeof CreateMcpConnectionRequest>

/** Omitting bearerToken keeps the stored one; switching authType to "none" deletes it. */
export const UpdateMcpConnectionRequest = z
  .object({
    name: z.string().trim().min(1).max(80),
    url: McpUrl,
    authType: McpAuthType,
    bearerToken: z.string().trim().min(1).max(8192),
  })
  .partial()
export type UpdateMcpConnectionRequest = z.infer<typeof UpdateMcpConnectionRequest>

export const McpConnection = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.string(),
  authType: McpAuthType,
  hasCredential: z.boolean(),
  status: McpConnectionStatus,
  lastError: z.string().nullable(),
  lastCheckedAt: z.iso.datetime({ offset: true }).nullable(),
  tools: z.array(McpTool),
  /** Active agents whose current version uses at least one of this connection's tools. */
  usedBy: z.array(z.object({ id: z.uuid(), name: z.string() })),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type McpConnection = z.infer<typeof McpConnection>

export const McpConnectionListResponse = z.object({ connections: z.array(McpConnection) })
export type McpConnectionListResponse = z.infer<typeof McpConnectionListResponse>

export const McpConnectionParams = WorkspaceParams.extend({ connectionId: z.uuid() })
export type McpConnectionParams = z.infer<typeof McpConnectionParams>

// --- Runs: playground sessions with a hosted agent ----------------------------------------------

export const RunStatus = z.enum([
  "running",
  "idle",
  /** Waiting for the user to approve or deny one or more "ask" actions. */
  "awaiting_approval",
  /** Paused at the run's spending cap. */
  "budget_reached",
  "ended",
  "error",
])
export type RunStatus = z.infer<typeof RunStatus>

export const RunUsage = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  /** List cost in US cents, as reported by the runtime. */
  costCents: z.number().int().nonnegative(),
})
export type RunUsage = z.infer<typeof RunUsage>

const EventBase = { id: z.string(), at: z.iso.datetime({ offset: true }) }

/** What happened in a run, normalized from the runtime's event stream. */
export const RunEvent = z.discriminatedUnion("kind", [
  z.object({ ...EventBase, kind: z.literal("user_message"), text: z.string() }),
  z.object({ ...EventBase, kind: z.literal("agent_message"), text: z.string() }),
  z.object({ ...EventBase, kind: z.literal("thinking") }),
  z.object({
    ...EventBase,
    kind: z.literal("tool_call"),
    toolName: z.string(),
    /** The connection's name in Clasp, or the runtime's server name if unknown. */
    connectionName: z.string(),
    input: z.record(z.string(), z.unknown()),
    /** How the runtime treated the call: "ask" waits for the user's decision. */
    permission: z.enum(["allow", "ask", "deny"]),
  }),
  z.object({
    ...EventBase,
    kind: z.literal("tool_result"),
    toolCallId: z.string(),
    output: z.string(),
    isError: z.boolean(),
  }),
  z.object({
    ...EventBase,
    kind: z.literal("tool_decision"),
    toolCallId: z.string(),
    decision: z.enum(["allow", "deny"]),
  }),
  z.object({
    ...EventBase,
    kind: z.literal("status"),
    status: RunStatus,
    /** Tool calls waiting for a decision when status is "awaiting_approval". */
    pendingToolCallIds: z.array(z.string()),
  }),
  z.object({ ...EventBase, kind: z.literal("usage"), usage: RunUsage }),
  z.object({ ...EventBase, kind: z.literal("error"), message: z.string() }),
])
export type RunEvent = z.infer<typeof RunEvent>

export const Run = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  agentVersion: z.number().int().positive(),
  status: RunStatus,
  usage: RunUsage,
  budgetCents: z.number().int().positive(),
  createdBy: User,
  startedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type Run = z.infer<typeof Run>

export const RunWithEvents = Run.extend({ events: z.array(RunEvent) })
export type RunWithEvents = z.infer<typeof RunWithEvents>

export const RunListResponse = z.object({ runs: z.array(Run) })
export type RunListResponse = z.infer<typeof RunListResponse>

export const SendRunMessageRequest = z.object({
  text: z.string().trim().min(1, "Write a message").max(20_000),
})
export type SendRunMessageRequest = z.infer<typeof SendRunMessageRequest>

export const ToolDecisionRequest = z.object({
  toolCallId: z.string().min(1),
  decision: z.enum(["allow", "deny"]),
  /** Shown to the agent when denying, so it can adjust. */
  denyMessage: z.string().trim().max(1000).optional(),
})
export type ToolDecisionRequest = z.infer<typeof ToolDecisionRequest>

export const RunParams = WorkspaceParams.extend({ runId: z.uuid() })
export type RunParams = z.infer<typeof RunParams>

/** Which runtime hosts agents; "simulated" means replies are placeholders (no API key set). */
export const PlatformResponse = z.object({
  runtime: z.object({ provider: z.string(), simulated: z.boolean() }),
})
export type PlatformResponse = z.infer<typeof PlatformResponse>
