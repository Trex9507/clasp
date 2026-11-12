import {
  Agent,
  AgentListResponse,
  AgentVersionsResponse,
  MeResponse,
  ModelsResponse,
  type AgentStatus,
  type CreateAgentRequest,
  type UpdateAgentRequest,
} from "@clasp/shared"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiDelete, apiGet, apiPatch, apiPost, errorDetail } from "@/lib/api-client"

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
