// CLAUDE.md rule 4: English only, never an em dash, in every tracked text file.
import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

const ROOT = new URL("../../", import.meta.url).pathname

// Words that only show up when Italian prose slips back in. Kept to terms with no
// English meaning so the check never fires on legitimate text.
const ITALIAN_WORDS = [
  "lavoro",
  "lavori",
  "agente",
  "agenti",
  "compratore",
  "fornitore",
  "fornitori",
  "prezzo",
  "rimborso",
  "consegna",
  "cauzione",
  "contestazione",
  "scheda",
  "verifica",
  "perché",
  "anche",
  "quindi",
  "sono",
  "della",
  "nella",
]
const ITALIAN = new RegExp(`\\b(${ITALIAN_WORDS.join("|")})\\b`, "i")

// Files allowed to contain the patterns, each with the reason. Keep this list short.
const ALLOWED: Record<string, string> = {
  "tests/guards/prose.test.ts": "defines the patterns this guard looks for",
  "packages/verifier/src/rules.ts": "Italian stopwords are data for detectLanguage",
}
const EM_DASH = new RegExp(String.fromCharCode(0x2014))

const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|zip|lock)$/i
const SKIPPED_FILES = new Set(["pnpm-lock.yaml"])

function trackedTextFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: ROOT,
    },
  ).toString()
  return out
    .split("\0")
    .filter(Boolean)
    .filter((f) => !BINARY.test(f) && !SKIPPED_FILES.has(f) && !(f in ALLOWED))
    .filter((f) => {
      try {
        return statSync(ROOT + f).isFile() // submodules show up as directories
      } catch {
        return false // deleted in the working tree
      }
    })
}

function offending(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const file of trackedTextFiles()) {
    readFileSync(ROOT + file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`)
      })
  }
  return hits
}

describe("prose guard", () => {
  it("has no em dash in any tracked text file", () => {
    expect(offending(EM_DASH)).toEqual([])
  })

  it("has no Italian prose in any tracked text file", () => {
    expect(offending(ITALIAN)).toEqual([])
  })
})
