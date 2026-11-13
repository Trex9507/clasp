import { Navigate, type RouteObject } from "react-router"

import { AppShell } from "@/components/app-shell"
import { LoadingPage } from "@/components/states"
import { NotFound } from "@/routes/not-found"
import { RootRedirect } from "@/routes/root-redirect"
import { WorkspaceLayout } from "@/routes/workspace-layout"

/**
 * The route table, separate from `router.tsx` so tests can mount it in a memory router.
 *
 * A data router with no loaders: TanStack Query is the one place server state lives, so
 * every route here renders and nothing here fetches.
 *
 * Pages load lazily, one chunk each, so the first visit downloads only the shell and the page
 * it lands on. The shell, layout and fallbacks stay eager: every screen needs them.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    // Shown while the first matched page's chunk downloads.
    HydrateFallback: LoadingPage,
    children: [
      { index: true, element: <RootRedirect /> },
      {
        path: "w/:workspaceId",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="agents" replace /> },
          {
            path: "agents",
            lazy: async () => ({
              Component: (await import("@/routes/agents/agents-page")).AgentsPage,
            }),
          },
          {
            path: "agents/new",
            lazy: async () => ({
              Component: (await import("@/routes/agents/create-agent-page")).CreateAgentPage,
            }),
          },
          {
            path: "agents/:agentId",
            lazy: async () => ({
              Component: (await import("@/routes/agents/agent-detail-page")).AgentDetailPage,
            }),
          },
          {
            path: "connections",
            lazy: async () => ({
              Component: (await import("@/routes/connections/connections-page")).ConnectionsPage,
            }),
          },
          { path: "*", element: <NotFound /> },
        ],
      },
      {
        path: "settings",
        lazy: async () => ({
          Component: (await import("@/routes/settings/settings-page")).SettingsPage,
        }),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]
