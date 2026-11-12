import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import "@fontsource-variable/inter"
import "./index.css"

import { ErrorBoundary } from "@/components/error-boundary"
import { Providers } from "@/providers"
import { router } from "@/router"

const container = document.getElementById("root")
if (!container) throw new Error("#root is missing from index.html")

createRoot(container).render(
  <StrictMode>
    {/* Outermost boundary: catches a failure in the providers or the shell itself, where the
        route-level boundary would never be mounted. */}
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
)
