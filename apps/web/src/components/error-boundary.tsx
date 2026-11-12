import { RotateCcw, TriangleAlert } from "lucide-react"
import * as React from "react"

/**
 * The last line of defence against a blank page.
 *
 * React unmounts the entire tree when a render throws, so without a boundary any error
 * produces a white page with no message and no way back.
 *
 * A class component because `getDerivedStateFromError` has no hook equivalent. `reset` clears
 * the error and re-renders: that fixes a transient failure and re-throws a deterministic one,
 * which is the honest outcome.
 */
type Props = {
  children: React.ReactNode
  /** Shown above the message: say which part of the app failed. */
  title?: string
}

type State = { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Logged rather than swallowed so the stack is still reachable from devtools.
    console.error("Unhandled render error", error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        className="mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center"
      >
        <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{this.props.title ?? "Something went wrong"}</h1>
        <p className="text-sm text-muted-foreground">
          This is a bug in Clasp itself. Your agents and connections have not been changed.
        </p>
        <pre className="max-w-full overflow-x-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Try again
          </button>
          {/* A plain anchor: this boundary can sit outside the router. */}
          <a
            href="/"
            className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
          >
            Back to home
          </a>
        </div>
      </div>
    )
  }
}
