import { LayoutGrid } from "lucide-react"

import { EmptyState } from "@/components/states"

export function NoWorkspace() {
  return (
    <EmptyState
      icon={LayoutGrid}
      title="No workspace yet"
      description="You are not a member of any workspace. A workspace holds your agents and connections; ask an owner to invite you, or create one once sign-up is available."
    />
  )
}
