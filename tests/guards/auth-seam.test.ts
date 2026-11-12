// CLAUDE.md invariant I6: `request.user` is set only in the auth seam, so replacing the deferred
// development login with real authentication touches exactly one file.
import { describe, expect, it } from "vitest"
import { filesUnder, read } from "./files.js"

const SEAM = "apps/api/src/auth/current-user.ts"
const SETS_USER = /decorateRequest\(\s*["']user["']|\b(request|req)\.user\s*=[^=]/

describe("auth seam guard", () => {
  it("sets request.user in the seam", () => {
    expect(SETS_USER.test(read(SEAM))).toBe(true)
  })

  it("sets request.user nowhere else", () => {
    const others = filesUnder("apps/api/src", /\.ts$/)
      .filter((f) => f !== SEAM)
      .filter((f) => SETS_USER.test(read(f)))
    expect(others).toEqual([])
  })
})
