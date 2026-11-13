// Settings for an eval run. The model under test is the platform default, so a model change in
// packages/shared shows up here as a regression or an improvement.
import { DEFAULT_MODEL_ID, findModel } from "@clasp/shared"

export const SUBJECT_MODEL = findModel(DEFAULT_MODEL_ID)?.providerModelId ?? "claude-sonnet-5-5"

// A different, stronger model judges, so the model under test never grades itself.
export const JUDGE_MODEL = "claude-opus-5-5"

/** List prices in USD per million tokens for the models evals call (claude-api skill table). */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
}

export interface RunSettings {
  /** Repetitions per case: nondeterminism is measured, not assumed away. */
  trials: number
  /** The run stops before spending more than this many US dollars. */
  budgetUsd: number
  maxConcurrency: number
}

export function runSettings(env: NodeJS.ProcessEnv = process.env): RunSettings {
  return {
    trials: Number(env.EVAL_TRIALS ?? 2),
    budgetUsd: Number(env.EVAL_BUDGET_USD ?? 2),
    maxConcurrency: Number(env.EVAL_CONCURRENCY ?? 4),
  }
}
