import { useQuery } from "@tanstack/react-query"
import type { DefaultError, QueryKey, UseQueryOptions } from "@tanstack/react-query"

import { usePreferences } from "@/lib/settings"

/**
 * The seam real-time updates will land behind.
 *
 * Today this is polling: agent runs happen server-side, and a view that only learned about
 * them on reload would look broken. Every live view calls `useLiveQuery`, so replacing the
 * transport with SSE or WebSockets later is a change to this file, not to every screen.
 *
 * `busyWhen` lets the cadence follow the data: something actually running is worth asking
 * about every couple of seconds, something idle is not.
 */

const BUSY_INTERVAL_MS = 2_000

export function useLiveQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    /** Given the latest response, is work actually in flight right now? */
    busyWhen?: (data: TQueryFnData) => boolean
  },
) {
  const { busyWhen, ...queryOptions } = options
  const { pollSeconds } = usePreferences()

  return useQuery({
    ...queryOptions,
    refetchInterval: (query) => {
      // Zero means polling is off in Settings, honoured even while something is running.
      if (pollSeconds <= 0) return false
      const data = query.state.data
      if (busyWhen && data !== undefined && busyWhen(data)) return BUSY_INTERVAL_MS
      return pollSeconds * 1000
    },
    refetchIntervalInBackground: true,
  })
}
