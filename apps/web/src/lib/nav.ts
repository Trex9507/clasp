import type { LucideIcon } from "lucide-react"
import { Bot, Plug, Settings } from "lucide-react"

/**
 * The sidebar's structure, as data.
 *
 * Workspace items are relative to the selected workspace (`/w/:workspaceId/<path>`), so
 * switching workspace keeps you on the same kind of page. Global items are absolute.
 */
export type NavItem = {
  label: string
  icon: LucideIcon
} & ({ scope: "workspace"; path: string } | { scope: "global"; to: string })

export const WORKSPACE_NAV: NavItem[] = [
  { scope: "workspace", path: "agents", label: "Agents", icon: Bot },
  { scope: "workspace", path: "connections", label: "Connections", icon: Plug },
]

export const GLOBAL_NAV: NavItem[] = [
  { scope: "global", to: "/settings", label: "Settings", icon: Settings },
]

export function workspacePath(workspaceId: string, path = "agents"): string {
  return `/w/${encodeURIComponent(workspaceId)}/${path}`
}

export function navHref(item: NavItem, workspaceId: string | undefined): string | undefined {
  if (item.scope === "global") return item.to
  return workspaceId ? workspacePath(workspaceId, item.path) : undefined
}

/**
 * The page under the current workspace, so the switcher can keep it when the workspace
 * changes (`/w/a/connections` becomes `/w/b/connections`).
 */
export function workspaceSection(pathname: string): string {
  const match = /^\/w\/[^/]+\/([^/]+)/.exec(pathname)
  const section = match?.[1]
  return section && WORKSPACE_NAV.some((i) => i.scope === "workspace" && i.path === section)
    ? section
    : "agents"
}
