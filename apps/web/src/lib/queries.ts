import { MeResponse, ModelsResponse } from "@clasp/shared"
import { useQuery } from "@tanstack/react-query"

import { apiGet } from "@/lib/api-client"

/** Query keys in one place, so invalidation never guesses at a string. */
export const queryKeys = {
  me: ["me"] as const,
  models: ["models"] as const,
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
