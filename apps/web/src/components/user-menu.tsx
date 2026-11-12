import { ChevronsUpDown, LogOut } from "lucide-react"
import { Dialog } from "react-aria-components"

import { DisabledWithReason } from "@/components/disabled-with-reason"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useMe } from "@/lib/queries"

function initials(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

/**
 * Who you are, in the sidebar footer.
 *
 * A popover rather than a menu because its one action is disabled until sign-in exists, and a
 * disabled menu item cannot explain itself.
 */
export function UserMenu() {
  const me = useMe()

  if (me.isPending) {
    return (
      <div className="flex items-center gap-2 p-2" aria-busy="true">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
    )
  }
  if (!me.data) return null

  const { name, email } = me.data.user
  const avatar = (
    <Avatar>
      <AvatarFallback>{initials(name, email)}</AvatarFallback>
    </Avatar>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <PopoverTrigger>
          <SidebarMenuButton size="lg" aria-label={`Account: ${name || email}`} tooltip={email}>
            {avatar}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name || email}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
          </SidebarMenuButton>
          <Popover placement="top start" className="w-64">
            <Dialog aria-label="Account" className="flex flex-col gap-3 outline-hidden">
              <div className="flex items-center gap-2">
                {avatar}
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-medium">{name || email}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
              </div>
              <DisabledWithReason reason="Sign-in arrives later" className="flex rounded-lg">
                <Button variant="outline" size="sm" isDisabled className="w-full justify-start">
                  <LogOut aria-hidden="true" />
                  Sign out
                </Button>
              </DisabledWithReason>
            </Dialog>
          </Popover>
        </PopoverTrigger>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
