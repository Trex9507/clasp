// CLAUDE.md invariant I3: one writer per aggregate. A repository's write functions may be
// imported only by the service that owns that aggregate; other services read, or go through the
// owner's exported functions.
import { basename, dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { filesUnder, read } from "./files.js"

/** Repository -> the only file allowed to import its write functions. */
const OWNERS: Record<string, string> = {
  "apps/api/src/agents/agent-repository.ts": "apps/api/src/agents/agent-service.ts",
  "apps/api/src/mcp/mcp-connection-repository.ts": "apps/api/src/mcp/mcp-connection-service.ts",
  "apps/api/src/runs/run-repository.ts": "apps/api/src/runs/run-service.ts",
}

const WRITE_FUNCTION = /^(insert|update|delete|append|set|mark|save)[A-Z]/

function importedFrom(file: string): { from: string; names: string[] }[] {
  const imports: { from: string; names: string[] }[] = []
  const pattern = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"(\.{1,2}\/[^"]+)"/g
  for (const match of read(file).matchAll(pattern)) {
    const [, names = "", spec = ""] = match
    const from = join(dirname(file), spec).replace(/\.js$/, ".ts")
    imports.push({
      from,
      names: names
        .split(",")
        .map(
          (n) =>
            n
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0] ?? "",
        )
        .filter(Boolean),
    })
  }
  return imports
}

describe("single writer guard", () => {
  const sources = filesUnder("apps/api/src", /\.ts$/).filter((f) => !f.endsWith(".test.ts"))

  it("knows every repository that has write functions", () => {
    const withWrites = filesUnder("apps/api/src", /-repository\.ts$/).filter((repo) =>
      [...read(repo).matchAll(/export async function (\w+)/g)].some(([, name]) =>
        WRITE_FUNCTION.test(name ?? ""),
      ),
    )
    expect(withWrites.sort()).toEqual(Object.keys(OWNERS).sort())
  })

  it("lets only the owning service import a repository's write functions", () => {
    const violations = sources.flatMap((file) =>
      importedFrom(file).flatMap(({ from, names }) => {
        const owner = OWNERS[from]
        if (!owner || file === owner) return []
        return names
          .filter((n) => WRITE_FUNCTION.test(n))
          .map((n) => `${file} imports ${n} from ${basename(from)}`)
      }),
    )
    expect(violations).toEqual([])
  })
})
