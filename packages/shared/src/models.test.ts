import { describe, expect, it } from "vitest"
import { DEFAULT_MODEL_ID, MODELS, findModel } from "./models.js"
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "./languages.js"

describe("model catalog", () => {
  it("uses provider-prefixed, unique IDs that match the provider model ID", () => {
    const ids = MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of MODELS) expect(m.id).toBe(`${m.provider}/${m.providerModelId}`)
  })

  it("has a default that is in the catalog", () => {
    expect(findModel(DEFAULT_MODEL_ID)).toBeDefined()
  })
})

describe("languages", () => {
  it("has unique codes and a default among them", () => {
    expect(new Set(LANGUAGE_CODES).size).toBe(LANGUAGE_CODES.length)
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE)
  })
})
