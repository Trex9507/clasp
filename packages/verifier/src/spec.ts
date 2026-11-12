import { z } from "zod"

// The signed job spec: the acceptance criteria buyer and provider agree on.
// This package owns the schema so the server and the verifier can never drift apart.
export const JobSpecSchema = z.object({
  type: z.enum(["listing_copy", "translation", "competitor_research"]),
  quantity: z.number().int().positive(),
  length: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    unit: z.enum(["characters", "words"]),
  }),
  language: z.string().min(2).max(5).optional(),
  tone: z.array(z.string()).optional(),
  banned_words: z.array(z.string()).optional(),
  format: z.object({
    type: z.enum(["json", "text", "markdown"]),
    fields: z.array(z.string()).optional(),
  }),
  deadline_hours: z.number().positive(),
  price_usdc: z.number().positive().max(100),
  negotiation_rounds: z.number().int().min(0).max(3).optional(),
})

export type JobSpec = z.infer<typeof JobSpecSchema>
export type LengthUnit = JobSpec["length"]["unit"]
