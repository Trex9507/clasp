import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Testing Library registers this automatically only with `globals: true`. This project runs
// with explicit imports, so the cleanup is explicit too; without it each test's DOM leaks
// into the next.
afterEach(() => {
  cleanup()
})

// jsdom has no matchMedia; the sidebar and theme provider read it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom has no CSS.escape; React Aria's popovers call it when they open.
if (typeof globalThis.CSS === "undefined") {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}
if (typeof CSS.escape !== "function") {
  CSS.escape = (value: string) => value.replace(/[^\w-]/g, (ch) => `\\${ch}`)
}
