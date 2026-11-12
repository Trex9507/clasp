// CLAUDE.md rule 1: every read and write is scoped to a workspace. Each exported repository
// function must take a `workspaceId` parameter, unless it is listed below with its reason.
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { filesUnder, read } from "./files.js"

const EXEMPT: Record<string, string> = {
  "apps/api/src/users/user-repository.ts#findUserByEmail": "users are global identities",
  "apps/api/src/workspaces/workspace-repository.ts#listWorkspacesForUser":
    "lists the workspaces a user may act in; it is how scope is found",
  "apps/api/src/runs/run-repository.ts#findEnvironment":
    "the runtime environment is shared infrastructure, not a workspace resource",
  "apps/api/src/runs/run-repository.ts#saveEnvironment":
    "the runtime environment is shared infrastructure, not a workspace resource",
}

function exportedFunctions(file: string): { name: string; params: string[] }[] {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
  const found: { name: string; params: string[] }[] = []
  for (const node of source.statements) {
    const exported = ts
      .getModifiers(node as ts.HasModifiers)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isFunctionDeclaration(node) && node.name) {
      found.push({ name: node.name.text, params: node.parameters.map((p) => p.name.getText()) })
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          found.push({
            name: decl.name.getText(),
            params: init.parameters.map((p) => p.name.getText()),
          })
        }
      }
    }
  }
  return found
}

describe("workspace scope guard", () => {
  const repositories = filesUnder("apps/api/src", /-repository\.ts$/)

  it("finds the repositories", () => {
    expect(repositories.length).toBeGreaterThan(0)
  })

  it("requires workspaceId on every exported repository function", () => {
    const unscoped = repositories.flatMap((file) =>
      exportedFunctions(file)
        .filter((fn) => !fn.params.includes("workspaceId"))
        .map((fn) => `${file}#${fn.name}`)
        .filter((key) => !(key in EXEMPT)),
    )
    expect(unscoped).toEqual([])
  })

  it("lists no exemption that no longer exists", () => {
    const all = new Set(
      repositories.flatMap((f) => exportedFunctions(f).map((fn) => `${f}#${fn.name}`)),
    )
    expect(Object.keys(EXEMPT).filter((key) => !all.has(key))).toEqual([])
  })
})
