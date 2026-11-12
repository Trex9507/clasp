import type { JobSpec } from "./spec.js"

// The three phase-1 job templates. A buyer starts from one of these; the
// provider may counter-propose changes during negotiation.
export const templates = {
  listing_copy: {
    type: "listing_copy",
    quantity: 30,
    length: { min: 40, max: 125, unit: "characters" },
    language: "en",
    tone: ["direct", "informal", "second person"],
    banned_words: ["free", "guaranteed", "miraculous"],
    format: { type: "json", fields: ["title", "text"] },
    deadline_hours: 2,
    price_usdc: 20,
  },

  translation: {
    type: "translation",
    quantity: 1,
    length: { min: 100, max: 5000, unit: "words" },
    language: "en", // target language
    tone: ["formal"],
    banned_words: [],
    format: { type: "text" },
    deadline_hours: 4,
    price_usdc: 15,
  },

  competitor_research: {
    type: "competitor_research",
    quantity: 5, // number of competitors analysed
    length: { min: 200, max: 800, unit: "words" },
    language: "en",
    tone: ["analytical"],
    banned_words: [],
    format: { type: "json", fields: ["name", "positioning", "strengths", "weaknesses"] },
    deadline_hours: 8,
    price_usdc: 25,
  },
} satisfies Record<string, JobSpec>

export type TemplateKey = keyof typeof templates
