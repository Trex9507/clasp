// The auth seam (CLAUDE.md, invariant I6). This is the only place `request.user` is set.
//
// Login is deferred: every request runs as the seeded development user. Real authentication
// (OIDC/SSO and email) replaces the body of `resolveUser` and nothing else.
import type { FastifyInstance } from "fastify"
import type { User } from "@clasp/shared"
import type { Db } from "../db/client.js"
import { findUserByEmail } from "../users/user-repository.js"

declare module "fastify" {
  interface FastifyRequest {
    user: User
  }
}

export function registerCurrentUser(app: FastifyInstance, db: Db, devUserEmail: string): void {
  let cached: User | undefined

  async function resolveUser(): Promise<User> {
    if (cached) return cached
    const row = await findUserByEmail(db, devUserEmail)
    if (!row) {
      throw new Error(
        `Development user ${devUserEmail} not found. Run: pnpm --filter @clasp/api db:seed`,
      )
    }
    cached = { id: row.id, email: row.email, name: row.name }
    return cached
  }

  app.decorateRequest("user", null as unknown as User)
  app.addHook("onRequest", async (request) => {
    request.user = await resolveUser()
  })
}
