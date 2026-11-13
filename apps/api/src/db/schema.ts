import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const workspaceKind = pgEnum("workspace_kind", ["personal", "organization"])
export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "member"])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
})

// Every resource belongs to a workspace. A personal workspace serves an individual (B2C); an
// organization workspace is shared by a team (B2B).
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: workspaceKind("kind").notNull(),
  ...timestamps,
})

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index().on(t.userId)],
)

export const agentStatus = pgEnum("agent_status", ["active", "archived"])
// "listed" is reserved for the marketplace; the API does not accept it yet.
export const agentVisibility = pgEnum("agent_visibility", ["private", "workspace", "listed"])
export const agentEffort = pgEnum("agent_effort", ["low", "medium", "high"])

export interface RuntimeRef {
  provider: string
  agentId: string
  version: number
}

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default(""),
    status: agentStatus("status").notNull().default("active"),
    visibility: agentVisibility("visibility").notNull().default("private"),
    // Null only inside the transaction that creates the agent and its first version.
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => agentVersions.id),
    // One runtime agent per Clasp agent; every version updates it in place.
    runtimeRef: jsonb("runtime_ref").$type<RuntimeRef>(),
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId, t.status)],
)

// Immutable (CLAUDE.md, I2): a configuration edit inserts a new row. The trigger in migration
// 0002 rejects UPDATEs to configuration columns; only `runtime_synced_version` may change, when
// the runtime acknowledges this version.
export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    model: text("model").notNull(),
    language: text("language").notNull(),
    effort: agentEffort("effort").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    // Filled by milestone B3: [{ connectionId, toolName, permission, usageNote? }].
    actions: jsonb("actions").$type<unknown[]>().notNull().default([]),
    // The runtime agent version that hosts this Clasp version; null until synced.
    runtimeSyncedVersion: integer("runtime_synced_version"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique().on(t.agentId, t.version)],
)
