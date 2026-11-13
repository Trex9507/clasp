import { Navigate, type RouteObject } from "react-router"

import { AppShell } from "@/components/app-shell"
import { AgentsPage } from "@/routes/agents/agents-page"
import { ConnectionsPage } from "@/routes/connections/connections-page"
import { NotFound } from "@/routes/not-found"
import { RootRedirect } from "@/routes/root-redirect"
import { SettingsPage } from "@/routes/settings/settings-page"
import { WorkspaceLayout } from "@/routes/workspace-layout"

/**
 * The route table, separate from `router.tsx` so tests can mount it in a memory router.
 *
 * A data router with no loaders: TanStack Query is the one place server state lives, so
 * every route here renders and nothing here fetches.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      {
        path: "w/:workspaceId",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="agents" replace /> },
          { path: "agents", element: <AgentsPage /> },
          { path: "connections", element: <ConnectionsPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]
