import type { Workspace } from "@clasp/shared"
import { Building2, ChevronsUpDown, User } from "lucide-react"
import { useLocation, useNavigate } from "react-router"

import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace } from "@/hooks/use-workspace"
import { workspacePath, workspaceSection } from "@/lib/nav"

const ROLE_LABELS: Record<Workspace["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

function WorkspaceIcon({ kind }: { kind: Workspace["kind"] }) {
  const Icon = kind === "personal" ? User : Building2
  return (
    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
      <Icon className="size-4" aria-hidden="true" />
    </div>
  )
}

/**
 * Which workspace everything below it belongs to.
 *
 * The selection lives in the URL (`/w/:workspaceId/...`), not in local state, so a link can be
 * shared and the back button undoes a switch. Switching keeps the current section: from a
 * workspace's Connections page you land on the other workspace's Connections page.
 */
export function WorkspaceSwitcher() {
  const { me, workspaces, fallback } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (me.isPending) {
    return (
      <div className="flex items-center gap-2 p-2" aria-busy="true">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 flex-1" />
      </div>
    )
  }

  if (!fallback) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" isDisabled tooltip="No workspace">
            <WorkspaceIcon kind="personal" />
            <span className="truncate text-sm text-muted-foreground">No workspace</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const current = fallback
  const section = workspaceSection(pathname)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger>
          <SidebarMenuButton
            size="lg"
            aria-label={`Workspace: ${current.name}. Switch workspace`}
            className="data-pressed:bg-sidebar-accent data-pressed:text-sidebar-accent-foreground"
          >
            <WorkspaceIcon kind={current.kind} />
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-semibold">{current.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {current.kind === "personal" ? "Personal" : "Organization"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
          </SidebarMenuButton>
          <DropdownMenu
            aria-label="Workspaces"
            className="min-w-56"
            selectionMode="single"
            selectedKeys={[current.id]}
            onAction={(key) => void navigate(workspacePath(String(key), section))}
          >
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} id={workspace.id} textValue={workspace.name}>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate">{workspace.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {workspace.kind === "personal" ? "Personal" : "Organization"} ·{" "}
                    {ROLE_LABELS[workspace.role]}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </DropdownMenuTrigger>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
