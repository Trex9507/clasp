import { PRICES } from "./config.js"

export interface TokenUsage {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

export class BudgetExceededError extends Error {}

/** Adds up what a run spends (model and judge calls) and stops it at the budget. */
export class CostMeter {
  spentUsd = 0

  constructor(readonly budgetUsd: number) {}

  record(model: string, usage: TokenUsage | null | undefined): number {
    const price = PRICES[model]
    if (!price || !usage) return 0
    // Cache writes cost 1.25x input and cache reads 0.1x input.
    const input =
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * 0.1
    const cost = (input * price.input + (usage.output_tokens ?? 0) * price.output) / 1_000_000
    this.spentUsd += cost
    return cost
  }

  /** For costs the runtime reports directly (hosted sessions). */
  addUsd(amount: number): void {
    this.spentUsd += amount
  }

  /** Call before each paid request, so an eval that overruns its budget fails loudly. */
  assertWithinBudget(): void {
    if (this.spentUsd >= this.budgetUsd) {
      throw new BudgetExceededError(
        `Eval budget of $${this.budgetUsd.toFixed(2)} reached ($${this.spentUsd.toFixed(2)} spent)`,
      )
    }
  }
}
