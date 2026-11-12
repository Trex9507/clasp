import { describe, it, expect } from "vitest"
import { verify } from "./rules.js"
import { templates } from "./templates.js"

const SPEC_COPY = { ...templates.listing_copy, quantity: 2 }

const GOOD_1 = "Discover the service built for you, with speed and quality first."
const GOOD_2 = "Do not miss this exclusive offer, made only for our loyal clients."

function makeItem(text: string) {
  return { title: "Test title", text }
}

describe("verifier: listing_copy", () => {
  it("passes a valid delivery", () => {
    const result = verify(SPEC_COPY, { items: [makeItem(GOOD_1), makeItem(GOOD_2)] })
    expect(result.failures).toEqual([])
    expect(result.passed).toBe(true)
  })

  it("fails on a banned word", () => {
    const result = verify(SPEC_COPY, {
      items: [
        makeItem("Get the product free today, for every new subscriber we have."),
        makeItem(GOOD_1),
      ],
    })
    expect(result.passed).toBe(false)
    expect(result.failures.some((f) => f.includes('"free"'))).toBe(true)
  })

  it("fails when an item is too short", () => {
    const result = verify(SPEC_COPY, { items: [makeItem("Short."), makeItem("Short.")] })
    expect(result.passed).toBe(false)
    expect(result.failures.some((f) => f.includes("too short"))).toBe(true)
  })

  it("fails when there are not enough items", () => {
    const result = verify(SPEC_COPY, { items: [makeItem(GOOD_1)] })
    expect(result.passed).toBe(false)
    expect(result.failures.some((f) => f.includes("not enough items"))).toBe(true)
  })

  it("fails when a required field is missing", () => {
    const result = verify(SPEC_COPY, { items: [{ title: "Title only" }, { title: "Title only" }] })
    expect(result.passed).toBe(false)
    expect(result.failures.some((f) => f.includes('missing field "text"'))).toBe(true)
  })

  it("fails when the language does not match", () => {
    const result = verify(SPEC_COPY, {
      items: [
        makeItem("Scopri il servizio pensato per te, con la qualità che non delude."),
        makeItem(GOOD_1),
      ],
    })
    expect(result.failures.some((f) => f.includes('detected language "it"'))).toBe(true)
  })

  it("flags tone for a model check", () => {
    const result = verify(SPEC_COPY, { items: [makeItem(GOOD_1), makeItem(GOOD_2)] })
    expect(result.needs_ai_check).toBe(true)
  })
})

describe("verifier: translation", () => {
  it("passes a valid text delivery", () => {
    const result = verify(templates.translation, { text: Array(120).fill("word").join(" ") })
    expect(result.passed).toBe(true)
  })
})

describe("verifier: competitor_research", () => {
  it("passes a valid delivery", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      name: `Competitor ${i + 1}`,
      positioning: Array(220).fill("market").join(" "),
      strengths: "Strong brand awareness and wide distribution across the market.",
      weaknesses: "High prices and little flexibility on tailored offers.",
    }))
    const result = verify(templates.competitor_research, { items })
    expect(result.passed).toBe(true)
  })
})
