import * as React from "react"

/**
 * Per-viewer preferences, in localStorage.
 *
 * These live in the browser rather than the database because none of them is product state:
 * they change how this browser shows the app, nothing else.
 */

export type Density = "comfortable" | "compact"

export type Preferences = {
  density: Density
  /** How often live views re-poll, in seconds. Zero disables polling. */
  pollSeconds: number
  /**
   * The workspace last opened in this browser, so pages outside a workspace (Settings) can
   * link back to it. The URL stays the source of truth inside `/w/:workspaceId`; an id that
   * no longer resolves falls back to the first workspace.
   */
  lastWorkspaceId: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  density: "comfortable",
  pollSeconds: 10,
  lastWorkspaceId: "",
}

const STORAGE_KEY = "clasp.preferences"

function read(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PREFERENCES
    // Merged over the defaults rather than trusted wholesale: a build that adds a preference
    // must not read `undefined` out of an object stored by the previous one.
    return { ...DEFAULT_PREFERENCES, ...(parsed as Partial<Preferences>) }
  } catch {
    // Private windows and storage-blocked contexts throw here. Defaults are a working app.
    return DEFAULT_PREFERENCES
  }
}

const listeners = new Set<() => void>()
let snapshot: Preferences = read()

function emit() {
  for (const listener of listeners) listener()
}

export function setPreferences(update: Partial<Preferences>) {
  snapshot = { ...snapshot, ...update }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Keep the in-memory value so the setting still works for this session.
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab writing the same key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = read()
      emit()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function usePreferences(): Preferences {
  return React.useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => DEFAULT_PREFERENCES,
  )
}
