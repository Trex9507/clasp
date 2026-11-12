import { and, asc, eq } from "drizzle-orm"
import type { Workspace } from "@clasp/shared"
import type { Db } from "../db/client.js"
import { workspaceMembers, workspaces } from "../db/schema.js"

const workspaceWithRole = {
  id: workspaces.id,
  name: workspaces.name,
  kind: workspaces.kind,
  role: workspaceMembers.role,
}

/** The caller's membership in one workspace, or undefined if they are not a member. */
export async function findMembership(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<Workspace | undefined> {
  const [row] = await db
    .select(workspaceWithRole)
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.id, workspaceId), eq(workspaceMembers.userId, userId)))
  return row
}

/** Every workspace the user belongs to. Exempt from workspace scope: it is how scope is found. */
export async function listWorkspacesForUser(db: Db, userId: string): Promise<Workspace[]> {
  return db
    .select(workspaceWithRole)
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.kind), asc(workspaces.createdAt))
}
