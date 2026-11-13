import { FolderX } from "lucide-react"
import * as React from "react"
import { Outlet } from "react-router"

import { EmptyState, ErrorState, LoadingPage } from "@/components/states"
import { LinkButton } from "@/components/ui/button"
import { useWorkspace } from "@/hooks/use-workspace"
import { workspacePath } from "@/lib/nav"
import { setPreferences } from "@/lib/settings"

/**
 * Everything under `/w/:workspaceId`. Renders its pages only once the id in the URL is known
 * to be one of the user's workspaces, so no page has to handle a workspace that is not there.
 */
export function WorkspaceLayout() {
  const { me, workspace, workspaces } = useWorkspace()

  React.useEffect(() => {
    if (workspace) setPreferences({ lastWorkspaceId: workspace.id })
  }, [workspace])

  if (me.isPending) return <LoadingPage />
  if (me.isError) {
    return (
      <ErrorState
        error={me.error}
        title="Could not load your workspaces"
        onRetry={() => void me.refetch()}
      />
    )
  }
  if (!workspace) {
    const first = workspaces[0]
    return (
      <EmptyState
        icon={FolderX}
        title="Workspace not found"
        description="This workspace does not exist, or you are not a member of it."
      >
        {first ? (
          <LinkButton href={workspacePath(first.id)} variant="outline">
            Go to {first.name}
          </LinkButton>
        ) : null}
      </EmptyState>
    )
  }
  return <Outlet />
}
