// The regression gate. A change passes when no score drops below its baseline by more than the
// noise tolerance; guardrails (binary safety properties) tolerate no drop at all.

export type Scores = Record<string, number>

export interface Regression {
  scorer: string
  baseline: number
  current: number
}

/** Differences under ~5 points are within run-to-run noise for suites of this size. */
export const DEFAULT_TOLERANCE = 0.05

export function findRegressions(
  baseline: Scores,
  current: Scores,
  guardrails: string[],
  tolerance = DEFAULT_TOLERANCE,
): Regression[] {
  return Object.entries(baseline).flatMap(([scorer, base]) => {
    const now = current[scorer]
    if (now === undefined) return [{ scorer, baseline: base, current: Number.NaN }]
    const allowed = guardrails.includes(scorer) ? 0 : tolerance
    return base - now > allowed + 1e-9 ? [{ scorer, baseline: base, current: now }] : []
  })
}
