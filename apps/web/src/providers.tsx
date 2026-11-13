import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import * as React from "react"

import { DensityAttribute } from "@/components/density"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { createQueryClient } from "@/lib/query-client"

/** TanStack Query owns every piece of server state; nothing else holds a copy of a row. */
export function Providers({
  children,
  queryClient: provided,
}: {
  children: React.ReactNode
  /** Tests pass their own client so one test's cache never leaks into the next. */
  queryClient?: QueryClient
}) {
  // Created in state, not at module scope, for the same reason.
  const [queryClient] = React.useState(() => provided ?? createQueryClient())

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <DensityAttribute />
        {children}
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
