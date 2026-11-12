import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider, useTheme } from "@/components/theme-provider"

/**
 * Storage failures must never take the page down.
 *
 * `localStorage` does not return null when it is unavailable - it throws.
 * A private window, blocked site data, or a cross-origin frame all raise a
 * SecurityError on plain access. Reading it from a `useState` initializer
 * therefore threw during render, React unmounted the whole tree, and
 * somebody whose only choice was to block cookies got a blank white page
 * with no message and no way back.
 *
 * This is the regression guard for that. It is worth a test rather than a
 * comment because the failure is invisible in every normal browser: it
 * passes every manual check and fails only for the people least able to
 * report it.
 */

function Probe() {
  const { theme } = useTheme()
  return <span data-testid="theme">{theme}</span>
}

function breakLocalStorage() {
  const boom = () => {
    throw new DOMException("The operation is insecure.", "SecurityError")
  }
  vi.stubGlobal("localStorage", {
    get getItem() {
      return boom
    },
    get setItem() {
      return boom
    },
    removeItem: boom,
    clear: boom,
    key: boom,
    length: 0,
  })
}

describe("ThemeProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ""
  })

  it("renders with a working default when localStorage throws", () => {
    breakLocalStorage()
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId("theme").textContent).toBe("system")
  })

  it("still applies a theme class when storage is unavailable", () => {
    breakLocalStorage()
    render(
      <ThemeProvider defaultTheme="dark">
        <Probe />
      </ThemeProvider>,
    )
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    // The browser's own canvas and scrollbars follow this, which is what
    // keeps a refresh from flashing white before the stylesheet lands.
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })

  it("reads a stored theme when storage works", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "dark",
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    })
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })
})
