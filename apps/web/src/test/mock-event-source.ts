import type { RunEvent } from "@clasp/shared"
import { act } from "@testing-library/react"
import { vi } from "vitest"

/**
 * A controllable stand-in for the browser `EventSource`, which jsdom does not have.
 *
 * Each instance opens on the next tick (like a real connection), and `push` delivers a
 * `run-event` message the way the API's stream does. `instances` keeps every source made, so a
 * test can find the stream of a run and check whether it was open at a given moment.
 */
export class MockEventSource extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: MockEventSource[] = []

  readonly url: string
  readyState = MockEventSource.CONNECTING

  constructor(url: string | URL) {
    super()
    this.url = String(url)
    MockEventSource.instances.push(this)
    setTimeout(() => {
      if (this.readyState !== MockEventSource.CONNECTING) return
      act(() => {
        this.readyState = MockEventSource.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }, 0)
  }

  /** Delivers events as the server would, one message each. */
  push(...events: RunEvent[]) {
    act(() => {
      for (const event of events) {
        this.dispatchEvent(new MessageEvent("run-event", { data: JSON.stringify(event) }))
      }
    })
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }

  /** The most recent open-or-connecting source for a URL ending in `suffix`. */
  static find(suffix: string): MockEventSource | undefined {
    return MockEventSource.instances.findLast(
      (source) => source.url.endsWith(suffix) && source.readyState !== MockEventSource.CLOSED,
    )
  }
}

/** Installs the mock as the global `EventSource`; undone by `vi.unstubAllGlobals()`. */
export function mockEventSource() {
  MockEventSource.instances = []
  vi.stubGlobal("EventSource", MockEventSource)
}
