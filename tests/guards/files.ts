import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

export const ROOT = new URL("../../", import.meta.url).pathname

/** Every file under `dir` (relative to the repo root) whose path matches `pattern`. */
export function filesUnder(dir: string, pattern: RegExp): string[] {
  const out: string[] = []
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      const path = join(abs, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (pattern.test(path)) out.push(relative(ROOT, path))
    }
  }
  walk(join(ROOT, dir))
  return out.sort()
}

export function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8")
}
