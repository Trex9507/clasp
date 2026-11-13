import {
  Agent,
  AgentListResponse,
  AgentVersionsResponse,
  McpConnection,
  McpConnectionListResponse,
  MeResponse,
  ModelsResponse,
  PlatformResponse,
  RunListResponse,
  RunWithEvents,
  type AgentStatus,
  type CreateAgentRequest,
  type CreateMcpConnectionRequest,
  type ToolDecisionRequest,
  type UpdateAgentRequest,
  type UpdateMcpConnectionRequest,
} from "@clasp/shared"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostNoContent,
  errorDetail,
} from "@/lib/api-client"

/** Query keys in one place, so invalidation never guesses at a string. */
export const queryKeys = {
  me: ["me"] as const,
  models: ["models"] as const,
  /** Prefix of every agent query in a workspace: invalidating it refreshes lists and details. */
  agents: (workspaceId: string) => ["workspaces", workspaceId, "agents"] as const,
  agentList: (workspaceId: string, status: AgentStatus) =>
    [...queryKeys.agents(workspaceId), "list", status] as const,
  agent: (workspaceId: string, agentId: string) =>
    [...queryKeys.agents(workspaceId), "detail", agentId] as const,
  agentVersions: (workspaceId: string, agentId: string) =>
    [...queryKeys.agent(workspaceId, agentId), "versions"] as const,
  /** Prefix of every MCP connection query in a workspace. */
  connections: (workspaceId: string) => ["workspaces", workspaceId, "mcp-connections"] as const,
  connectionList: (workspaceId: string) => [...queryKeys.connections(workspaceId), "list"] as const,
  connection: (workspaceId: string, connectionId: string) =>
    [...queryKeys.connections(workspaceId), "detail", connectionId] as const,
  platform: ["platform"] as const,
  agentRuns: (workspaceId: string, agentId: string) =>
    [...queryKeys.agent(workspaceId, agentId), "runs"] as const,
  run: (workspaceId: string, runId: string) => ["workspaces", workspaceId, "runs", runId] as const,
}

function agentsPath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/agents`
}

function agentPath(workspaceId: string, agentId: string): string {
  return `${agentsPath(workspaceId)}/${encodeURIComponent(agentId)}`
}

/** The signed-in user and the workspaces they belong to. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet("/api/v1/me", MeResponse, { signal }),
  })
}

/** The model catalog an agent can choose from. It changes only on deploy. */
export function useModels() {
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: ({ signal }) => apiGet("/api/v1/models", ModelsResponse, { signal }),
    staleTime: Infinity,
  })
}

/** The workspace's agents with one status, newest activity first as the API orders them. */
export function useAgents(workspaceId: string, status: AgentStatus) {
  return useQuery({
    queryKey: queryKeys.agentList(workspaceId, status),
    queryFn: ({ signal }) =>
      apiGet(`${agentsPath(workspaceId)}?status=${status}`, AgentListResponse, { signal }),
  })
}

/** One agent with its current version. Pass `enabled: false` for an id that cannot exist. */
export function useAgent(workspaceId: string, agentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agent(workspaceId, agentId),
    queryFn: ({ signal }) => apiGet(agentPath(workspaceId, agentId), Agent, { signal }),
    enabled,
  })
}

/** Every version of an agent, newest first. */
export function useAgentVersions(workspaceId: string, agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentVersions(workspaceId, agentId),
    queryFn: ({ signal }) =>
      apiGet(`${agentPath(workspaceId, agentId)}/versions`, AgentVersionsResponse, { signal }),
  })
}

export function useCreateAgent(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAgentRequest) => apiPost(agentsPath(workspaceId), Agent, body),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agent(workspaceId, agent.id), agent)
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents(workspaceId) })
      toast.success(`Created ${agent.name}`)
    },
    onError: (error) => {
      toast.error("Could not create the agent", { description: errorDetail(error) })
    },
  })
}

export function useUpdateAgent(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.agent(workspaceId, agentId)
  return useMutation({
    mutationFn: (body: UpdateAgentRequest) =>
      apiPatch(agentPath(workspaceId, agentId), Agent, body),
    onSuccess: (agent) => {
      // Read before overwriting: the version number going up is what tells the user their
      // edit created a new version rather than only renaming the agent.
      const previous = queryClient.getQueryData<Agent>(key)?.currentVersion.version
      queryClient.setQueryData(key, agent)
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents(workspaceId) })
      const version = agent.currentVersion.version
      toast.success(previous !== undefined && version > previous ? `Saved as v${version}` : "Saved")
    },
    onError: (error) => {
      toast.error("Could not save the agent", { description: errorDetail(error) })
    },
  })
}

export function useArchiveAgent(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (agentId: string) => apiDelete(agentPath(workspaceId, agentId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents(workspaceId) })
      toast.success("Agent archived")
    },
    onError: (error) => {
      toast.error("Could not archive the agent", { description: errorDetail(error) })
    },
  })
}

export function useSyncAgent(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost(`${agentPath(workspaceId, agentId)}/sync`, Agent),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agent(workspaceId, agentId), agent)
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents(workspaceId) })
      if (agent.currentVersion.runtimeSynced) toast.success("Agent synced")
      else toast.error("Still not synced", { description: "The runtime did not accept it yet." })
    },
    onError: (error) => {
      toast.error("Could not sync the agent", { description: errorDetail(error) })
    },
  })
}

// --- MCP connections ---------------------------------------------------------------------------

function connectionsPath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/mcp-connections`
}

function connectionPath(workspaceId: string, connectionId: string): string {
  return `${connectionsPath(workspaceId)}/${encodeURIComponent(connectionId)}`
}

function toolCount(count: number): string {
  return count === 1 ? "1 tool" : `${count} tools`
}

/**
 * One toast for every call that ends in discovery. The API saves a connection even when its
 * server cannot be reached, so "saved" and "reachable" are reported separately.
 */
function reportDiscovery(verb: string, connection: McpConnection) {
  if (connection.status === "error") {
    toast.warning(`${verb} ${connection.name}, but could not reach it`, {
      description: connection.lastError ?? "Discovery failed.",
    })
  } else if (connection.status === "ok") {
    toast.success(`${verb} ${connection.name}`, {
      description: `Found ${toolCount(connection.tools.length)}.`,
    })
  } else {
    toast.success(`${verb} ${connection.name}`)
  }
}

/**
 * A connection change can turn agents' actions stale (or fresh again) and changes `usedBy`,
 * so it refreshes both the connections and the agents of the workspace.
 */
function useInvalidateConnections(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.connections(workspaceId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.agents(workspaceId) })
  }
}

/** The workspace's MCP connections with their discovered tools. */
export function useConnections(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.connectionList(workspaceId),
    queryFn: ({ signal }) =>
      apiGet(connectionsPath(workspaceId), McpConnectionListResponse, { signal }),
  })
}

export function useConnection(workspaceId: string, connectionId: string) {
  return useQuery({
    queryKey: queryKeys.connection(workspaceId, connectionId),
    queryFn: ({ signal }) =>
      apiGet(connectionPath(workspaceId, connectionId), McpConnection, { signal }),
  })
}

export function useCreateConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (body: CreateMcpConnectionRequest) =>
      apiPost(connectionsPath(workspaceId), McpConnection, body),
    onSuccess: (connection) => {
      invalidate()
      reportDiscovery("Connected", connection)
    },
    onError: (error) => {
      toast.error("Could not add the connection", { description: errorDetail(error) })
    },
  })
}

export function useUpdateConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMcpConnectionRequest }) =>
      apiPatch(connectionPath(workspaceId, id), McpConnection, body),
    onSuccess: (connection) => {
      invalidate()
      reportDiscovery("Saved", connection)
    },
    onError: (error) => {
      toast.error("Could not save the connection", { description: errorDetail(error) })
    },
  })
}

export function useDeleteConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (connectionId: string) => apiDelete(connectionPath(workspaceId, connectionId)),
    onSuccess: () => {
      invalidate()
      toast.success("Connection deleted")
    },
    onError: (error) => {
      // A 409 names the agents still using the connection; its detail is the whole message.
      toast.error("Could not delete the connection", { description: errorDetail(error) })
    },
  })
}

/** Re-runs tool discovery. A failure (502) still updates the stored status, so both refresh. */
export function useDiscoverConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiPost(`${connectionPath(workspaceId, connectionId)}/discover`, McpConnection),
    onSuccess: (connection) => {
      reportDiscovery("Checked", connection)
    },
    onError: (error) => {
      toast.error("Could not reach the server", { description: errorDetail(error) })
    },
    onSettled: () => invalidate(),
  })
}

// --- Runs (the Playground) ---------------------------------------------------------------------

function runPath(workspaceId: string, runId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(runId)}`
}

/** Which runtime hosts agents. It changes only on deploy. */
export function usePlatform() {
  return useQuery({
    queryKey: queryKeys.platform,
    queryFn: ({ signal }) => apiGet("/api/v1/platform", PlatformResponse, { signal }),
    staleTime: Infinity,
  })
}

/** An agent's most recent runs, newest first. */
export function useRuns(workspaceId: string, agentId: string) {
  return useQuery({
    queryKey: queryKeys.agentRuns(workspaceId, agentId),
    queryFn: ({ signal }) =>
      apiGet(`${agentPath(workspaceId, agentId)}/runs`, RunListResponse, { signal }),
  })
}

/**
 * One run with its history. Live changes arrive through `useRunStream`; this query supplies
 * what the stream does not carry (the pinned version, the budget) and the starting point.
 */
export function useRun(workspaceId: string, runId: string | null) {
  return useQuery({
    queryKey: queryKeys.run(workspaceId, runId ?? ""),
    queryFn: ({ signal }) => apiGet(runPath(workspaceId, runId ?? ""), RunWithEvents, { signal }),
    enabled: runId !== null,
  })
}

/**
 * Starts a run. Failures (an archived or not yet hosted agent) are shown inline by the
 * composer that started it, so there is no toast here.
 */
export function useStartRun(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost(`${agentPath(workspaceId, agentId)}/runs`, RunWithEvents),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.run(workspaceId, run.id), run)
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(workspaceId, agentId) })
    },
  })
}

/** Sends a user message. Like starting a run, its failure is shown inline by the composer. */
export function useSendRunMessage(workspaceId: string) {
  return useMutation({
    mutationFn: ({ runId, text }: { runId: string; text: string }) =>
      apiPostNoContent(`${runPath(workspaceId, runId)}/messages`, { text }),
  })
}

export function useToolDecision(workspaceId: string, runId: string) {
  return useMutation({
    mutationFn: (body: ToolDecisionRequest) =>
      apiPostNoContent(`${runPath(workspaceId, runId)}/tool-decisions`, body),
    onError: (error) => {
      toast.error("Could not send your decision", { description: errorDetail(error) })
    },
  })
}

export function useInterruptRun(workspaceId: string, runId: string) {
  return useMutation({
    mutationFn: () => apiPostNoContent(`${runPath(workspaceId, runId)}/interrupt`),
    onError: (error) => {
      toast.error("Could not stop the agent", { description: errorDetail(error) })
    },
  })
}
