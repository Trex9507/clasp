import type { McpTool } from "@clasp/shared"
import { ChevronRight } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type InputRow = { name: string; type: string; required: boolean; description: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function typeOf(schema: Record<string, unknown>): string {
  const { type } = schema
  if (typeof type === "string") {
    if (type === "array" && isRecord(schema.items) && typeof schema.items.type === "string") {
      return `${schema.items.type}[]`
    }
    return type
  }
  if (Array.isArray(type)) return type.filter((t) => typeof t === "string").join(" | ")
  if (Array.isArray(schema.enum)) return "enum"
  return "any"
}

/**
 * The rows of a tool's input schema, or null when the schema is not a plain object of
 * properties (then the caller shows the raw JSON instead of guessing).
 */
function inputRows(inputSchema: McpTool["inputSchema"]): InputRow[] | null {
  const { properties } = inputSchema
  if (properties === undefined) return []
  if (!isRecord(properties)) return null
  const required = Array.isArray(inputSchema.required) ? inputSchema.required : []
  const rows: InputRow[] = []
  for (const [name, schema] of Object.entries(properties)) {
    if (!isRecord(schema)) return null
    rows.push({
      name,
      type: typeOf(schema),
      required: required.includes(name),
      description: typeof schema.description === "string" ? schema.description : "",
    })
  }
  return rows
}

/** A read-only preview of what a tool expects, collapsed until asked for. */
export function ToolInputs({ tool, idPrefix }: { tool: McpTool; idPrefix: string }) {
  const [open, setOpen] = React.useState(false)
  const panelId = `${idPrefix}-inputs`
  const rows = React.useMemo(() => inputRows(tool.inputSchema), [tool.inputSchema])

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        Inputs
      </button>
      {open ? (
        <div id={panelId} className="mt-2">
          {rows === null ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">This tool takes no inputs.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Inputs of {tool.name}</caption>
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-1.5 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-2 py-1.5 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-2 py-1.5 font-medium">
                      Required
                    </th>
                    <th scope="col" className="px-2 py-1.5 font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td className="px-2 py-1.5 font-mono">{row.name}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.type}</td>
                      <td className="px-2 py-1.5">{row.required ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
