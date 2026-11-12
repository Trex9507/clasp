import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DensityAttribute } from "@/components/density"
import { DEFAULT_PREFERENCES, setPreferences } from "@/lib/settings"

/**
 * Density is applied as one attribute on `<html>` and styled once in CSS.
 *
 * This pins the mechanism: the attribute is set, and it tracks the
 * preference.
 *
 * What it deliberately cannot check is the CSS. jsdom does not apply
 * stylesheets, so "compact is actually tighter" is verified against a real
 * browser instead.
 */
describe("DensityAttribute", () => {
  afterEach(() => {
    setPreferences(DEFAULT_PREFERENCES)
    delete document.documentElement.dataset.density
  })

  it("writes the default density to the document root", () => {
    render(<DensityAttribute />)
    expect(document.documentElement.dataset.density).toBe("comfortable")
  })

  it("follows the preference when it changes", () => {
    render(<DensityAttribute />)

    // The store lives outside React, so the re-render and its effect have
    // to be flushed before the attribute is readable.
    act(() => setPreferences({ density: "compact" }))
    expect(document.documentElement.dataset.density).toBe("compact")

    act(() => setPreferences({ density: "comfortable" }))
    expect(document.documentElement.dataset.density).toBe("comfortable")
  })
})
