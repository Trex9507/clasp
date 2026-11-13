import * as React from "react"

import { usePreferences } from "@/lib/settings"

/**
 * Applies the density preference to the document root.
 *
 * An attribute on `<html>`, styled once in `index.css`, rather than a prop
 * threaded to each table. The prop version was written first and did not
 * work: it reached exactly one of the four tables, so changing the setting
 * and then opening Organizations appeared to do nothing - and every table
 * added later would have started life ignoring it too.
 *
 * Same shape as the theme for the same reason: one writer, one selector,
 * and a new table inherits the behaviour by existing rather than by
 * remembering to opt in.
 */
export function DensityAttribute() {
  const { density } = usePreferences()

  React.useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  return null
}
