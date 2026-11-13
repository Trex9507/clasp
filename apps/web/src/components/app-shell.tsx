import { Link2 } from "lucide-react"
import { RouterProvider } from "react-aria-components"
import { Outlet, useHref, useLocation, useNavigate } from "react-router"

import { ErrorBoundary } from "@/components/error-boundary"
import { UserMenu } from "@/components/user-menu"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useWorkspace } from "@/hooks/use-workspace"
import { GLOBAL_NAV, WORKSPACE_NAV, navHref, type NavItem } from "@/lib/nav"

/**
 * Teaches every React Aria component with an `href` to navigate through React Router instead
 * of doing a full page load, which would throw away the query cache and the sidebar state.
 */
function AriaRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <RouterProvider navigate={(to, options) => void navigate(to, options)} useHref={useHref}>
      {children}
    </RouterProvider>
  )
}

function NavItems({ items, workspaceId }: { items: NavItem[]; workspaceId: string | undefined }) {
  const { pathname } = useLocation()
  return (
    <SidebarMenu>
      {items.map((item) => {
        const href = navHref(item, workspaceId)
        const active = href !== undefined && pathname.startsWith(href)
        return (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              href={href}
              isDisabled={href === undefined}
              isActive={active}
              // The accessible name for the icon-only state.
              tooltip={item.label}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function AppSidebar() {
  const { fallback } = useWorkspace()
  const workspaceNav = fallback?.id

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 pt-1 pb-2 group-data-[collapsible=icon]:hidden">
          <Link2 className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight">Clasp</span>
        </div>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Build</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={WORKSPACE_NAV} workspaceId={workspaceNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <NavItems items={GLOBAL_NAV} workspaceId={workspaceNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <AriaRouter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <SidebarTrigger aria-label="Toggle navigation" />
          </header>
          {/* One content column for every page, centred and capped so a wide monitor does not
              stretch a list across the full width. */}
          <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col p-4 md:p-6">
            {/* Keyed by path: navigating away from a broken page clears the error. */}
            <ErrorBoundary key={pathname} title="This page could not be shown">
              <Outlet />
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AriaRouter>
  )
}
