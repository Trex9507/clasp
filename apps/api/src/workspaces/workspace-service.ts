import type { MeResponse, User, Workspace } from "@clasp/shared"
import type { Db } from "../db/client.js"
import { NotFoundError } from "../errors.js"
import { findMembership, listWorkspacesForUser } from "./workspace-repository.js"

/**
 * The single membership check every workspace-scoped route goes through. A workspace the caller
 * does not belong to answers 404, exactly like one that does not exist, so IDs cannot be probed.
 */
export async function assertWorkspaceAccess(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<Workspace> {
  const membership = await findMembership(db, workspaceId, userId)
  if (!membership) throw new NotFoundError("Workspace not found")
  return membership
}

export async function getMe(db: Db, user: User): Promise<MeResponse> {
  return { user, workspaces: await listWorkspacesForUser(db, user.id) }
}
