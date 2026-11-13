import { QueryClient } from "@tanstack/react-query"

import { errorStatus } from "@/lib/api-client"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        staleTime: 5_000,
        // A 4xx is an answer, not a fault: retrying a 404 only delays showing what happened.
        retry: (failureCount, error) => {
          const status = errorStatus(error)
          if (status !== undefined && status >= 400 && status < 500) return false
          return failureCount < 2
        },
      },
      mutations: {
        // Never retried: replaying a write because the response was slow could apply it twice.
        retry: false,
      },
    },
  })
}
