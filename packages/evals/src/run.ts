// `pnpm --filter @clasp/evals eval [--suite <name>...] [--first N] [--update-baseline]`
//
// Runs each suite with Braintrust's Eval(). Without BRAINTRUST_API_KEY results stay on this
// machine (noSendLogs); with it they become Braintrust experiments you can diff in the UI.
// Exits non-zero on a regression against baselines/<suite>.json, an errored case, or the budget.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { Eval } from "braintrust"
import { ManagedAgentsRuntime } from "@clasp/runtime"
import { findRegressions, type Scores } from "./baseline.js"
import { JUDGE_MODEL, runSettings, SUBJECT_MODEL } from "./config.js"
import { CostMeter } from "./cost.js"
import { HostedAgents } from "./subjects/hosted-agent.js"
import { actionsSuite } from "./suites/actions.js"
import { injectionSuite } from "./suites/injection.js"
import { languageSuite } from "./suites/language.js"
import type { Suite, SuiteContext } from "./suites/suite.js"

const SUITES = [actionsSuite, injectionSuite, languageSuite] as Suite<unknown, unknown>[]
const ROOT = new URL("../", import.meta.url)

function arg(name: string): string[] {
  const values: string[] = []
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) values.push(process.argv[i + 1] as string)
  })
  return values
}

function gitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim()
  } catch {
    return "local"
  }
}

async function main(): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "Evals skipped: set ANTHROPIC_API_KEY to run them (they call Claude and cost money).",
    )
    return 0
  }
  const selected = arg("--suite")
  const suites = selected.length ? SUITES.filter((s) => selected.includes(s.name)) : SUITES
  const first = Number(arg("--first")[0] ?? Infinity)
  const updateBaseline = process.argv.includes("--update-baseline")
  const settings = runSettings()
  const meter = new CostMeter(settings.budgetUsd)
  const runtime = new ManagedAgentsRuntime()
  const ctx: SuiteContext = {
    client: new Anthropic(),
    hosted: new HostedAgents(runtime, SUBJECT_MODEL),
    meter,
    model: SUBJECT_MODEL,
  }
  const noSendLogs = !process.env.BRAINTRUST_API_KEY
  const sha = gitSha()
  let failed = false

  mkdirSync(new URL("results/", ROOT), { recursive: true })
  try {
    for (const suite of suites) {
      const cases = suite.cases.slice(0, first)
      const result = await Eval(
        "Clasp",
        {
          experimentName: `${suite.name}@${sha}`,
          data: () => cases.map((c) => ({ input: c.input, metadata: c.metadata })),
          task: (input) => suite.task(ctx, input),
          scores: [({ input, output }) => suite.score(ctx, input, output)],
          trialCount: settings.trials,
          maxConcurrency: settings.maxConcurrency,
          metadata: { suite: suite.name, model: SUBJECT_MODEL, judge: JUDGE_MODEL, commit: sha },
        },
        { noSendLogs },
      )

      const scores: Scores = Object.fromEntries(
        Object.entries(result.summary.scores).map(([name, s]) => [name, s.score]),
      )
      const errored = result.results.filter((r) => r.error)
      // Full per-case records, so a failing case can be read end to end.
      writeFileSync(
        new URL(`results/${suite.name}.json`, ROOT),
        JSON.stringify(
          { suite: suite.name, commit: sha, scores, results: result.results },
          null,
          2,
        ),
      )

      const baselineUrl = new URL(`baselines/${suite.name}.json`, ROOT)
      console.log(`\n${suite.name}: ${JSON.stringify(scores)}  (errors: ${errored.length})`)
      if (errored.length > 0) {
        failed = true
        for (const r of errored) console.log(`  error: ${String(r.error)}`)
      }
      if (updateBaseline) {
        writeFileSync(
          baselineUrl,
          JSON.stringify(
            { model: SUBJECT_MODEL, judge: JUDGE_MODEL, commit: sha, scores },
            null,
            2,
          ) + "\n",
        )
        console.log(`  baseline updated: baselines/${suite.name}.json`)
      } else if (existsSync(baselineUrl)) {
        const baseline = JSON.parse(readFileSync(baselineUrl, "utf8")) as { scores: Scores }
        const regressions = findRegressions(baseline.scores, scores, suite.guardrails)
        for (const r of regressions) {
          console.log(
            `  REGRESSION ${r.scorer}: ${r.baseline.toFixed(3)} -> ${r.current.toFixed(3)}`,
          )
        }
        if (regressions.length > 0) failed = true
      } else {
        console.log("  no baseline yet: run with --update-baseline once the results are reviewed")
      }
    }
  } finally {
    await ctx.hosted.cleanup()
    console.log(`\nSpent about $${meter.spentUsd.toFixed(2)} of the $${settings.budgetUsd} budget.`)
  }
  return failed ? 1 : 0
}

process.exitCode = await main()
