// Starts one throwaway Postgres for the whole test run and applies the migrations once.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import type { TestProject } from "vitest/node"
import { createDatabase, runMigrations } from "../db/client.js"

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16-alpine").start()
  const url = container.getConnectionUri()
  const database = createDatabase(url)
  try {
    await runMigrations(database.db)
  } finally {
    await database.close()
  }
  project.provide("databaseUrl", url)
}

export async function teardown(): Promise<void> {
  await container?.stop()
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string
  }
}
