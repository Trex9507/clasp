import type { Workspace } from "@clasp/shared"
import { useParams } from "react-router"

import { useMe } from "@/lib/queries"
import { usePreferences } from "@/lib/settings"

/**
 * The workspace the URL names, resolved against `/me`.
 *
 * `workspace` is undefined while `/me` loads, outside `/w/:workspaceId`, or when the id in the
 * URL is not one of the user's workspaces. `fallback` is where workspace links should point
 * when the URL has none: the last workspace opened here if it still exists, else the first.
 */
export function useWorkspace() {
  const { workspaceId } = useParams()
  const me = useMe()
  const { lastWorkspaceId } = usePreferences()
  const workspaces: Workspace[] = me.data?.workspaces ?? []

  const workspace = workspaceId ? workspaces.find((w) => w.id === workspaceId) : undefined
  const fallback =
    workspace ?? workspaces.find((w) => w.id === lastWorkspaceId) ?? workspaces[0] ?? undefined

  return { me, workspaceId, workspace, workspaces, fallback }
}
