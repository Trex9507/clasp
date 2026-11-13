import { Monitor, Moon, Sun } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { setPreferences, usePreferences, type Density } from "@/lib/settings"

const THEMES: { value: "light" | "dark" | "system"; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

const DENSITIES: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const preferences = usePreferences()

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Settings" description="Stored in this browser only." />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              System follows your operating system's setting and updates when it changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
              {THEMES.map((option) => {
                const active = theme === option.value
                return (
                  <Button
                    key={option.value}
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onPress={() => setTheme(option.value)}
                  >
                    <option.icon className="size-4" aria-hidden="true" />
                    {option.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Density</CardTitle>
            <CardDescription>How much room each table row gets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Density">
              {DENSITIES.map((option) => {
                const active = preferences.density === option.value
                return (
                  <Button
                    key={option.value}
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onPress={() => setPreferences({ density: option.value })}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
