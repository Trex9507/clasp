import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageHeader } from "@/components/page-header"

/**
 * The back affordance is an arrow, and an arrow is only navigation if it
 * says where it goes and can be reached without a mouse. Both are easy to
 * lose in a restyle, so they are pinned here.
 *
 * What this deliberately cannot check is the gutter itself: the column
 * that keeps the arrow out of the title's way is a Tailwind breakpoint
 * class, and jsdom applies no stylesheets. Whether the arrow clears the
 * content column, and whether the h1 still starts on the container's left
 * edge, is a visual check against a running app.
 */
describe("PageHeader", () => {
  it("gives the back arrow a destination and a name", () => {
    render(<PageHeader title="An agent" back={{ href: "/w/1/agents", label: "Back" }} />)

    const link = screen.getByRole("link", { name: "Back" })
    expect(link.getAttribute("href")).toBe("/w/1/agents")

    // Before the heading in DOM order, so tabbing into the page reaches
    // the way out first rather than after every control on it.
    expect(
      link.compareDocumentPosition(screen.getByRole("heading", { level: 1 })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("renders no arrow on a page that is not below another", () => {
    render(<PageHeader title="Agents" />)
    expect(screen.queryByRole("link")).toBeNull()
  })
})
