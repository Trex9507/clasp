import type { McpAuthType } from "@clasp/shared"

export const AUTH_OPTIONS: { value: McpAuthType; label: string }[] = [
  { value: "none", label: "No auth" },
  { value: "bearer", label: "Bearer token" },
]

export function authLabel(authType: McpAuthType): string {
  return AUTH_OPTIONS.find((option) => option.value === authType)?.label ?? authType
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
