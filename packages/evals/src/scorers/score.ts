/** A scorer result, in the shape Braintrust's Eval() accepts. `null` leaves the case out of the mean. */
export interface Score {
  name: string
  score: number | null
  metadata?: Record<string, unknown>
}
