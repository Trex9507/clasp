import { Navigate } from "react-router"

import { ErrorState, LoadingPage } from "@/components/states"
import { useMe } from "@/lib/queries"
import { workspacePath } from "@/lib/nav"
import { NoWorkspace } from "@/routes/no-workspace"

/** `/` has no page of its own: it opens the first workspace's agents. */
export function RootRedirect() {
  const me = useMe()

  if (me.isPending) return <LoadingPage />
  if (me.isError) {
    return (
      <ErrorState
        error={me.error}
        title="Could not load your account"
        onRetry={() => void me.refetch()}
      />
    )
  }

  const first = me.data.workspaces[0]
  if (!first) return <NoWorkspace />
  return <Navigate to={workspacePath(first.id)} replace />
}
