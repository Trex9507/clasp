import { randomUUID } from "node:crypto"
import { buildSystemPrompt } from "./system-prompt.js"
import {
  RuntimeError,
  type AgentRuntime,
  type AgentVersionSpec,
  type McpCredential,
  type RuntimeAgentRef,
  type RuntimeVaultRef,
} from "./types.js"

interface FakeAgent {
  versions: { spec: AgentVersionSpec; system: string }[]
  archived: boolean
}

/**
 * In-memory runtime for tests and for local development without an Anthropic key. It mirrors
 * the Managed Agents contract that matters to the platform: create returns version 1, an update
 * that changes nothing keeps the version, and archived agents reject updates.
 */
export class FakeRuntime implements AgentRuntime {
  readonly provider = "fake"
  readonly agents = new Map<string, FakeAgent>()
  /** vaultId -> credentialId -> credential */
  readonly vaults = new Map<string, Map<string, McpCredential>>()
  /** Set to make the next call fail, to exercise the platform's not-synced path. */
  failNext: string | undefined

  private maybeFail(): void {
    if (this.failNext) {
      const message = this.failNext
      this.failNext = undefined
      throw new RuntimeError(message)
    }
  }

  async upsertAgent(spec: AgentVersionSpec, ref?: RuntimeAgentRef): Promise<RuntimeAgentRef> {
    this.maybeFail()
    const system = buildSystemPrompt(spec.systemPrompt, spec.language, spec.actions)
    if (!ref) {
      const agentId = `fake_agent_${randomUUID()}`
      this.agents.set(agentId, { versions: [{ spec, system }], archived: false })
      return { provider: this.provider, agentId, version: 1 }
    }
    const agent = this.agents.get(ref.agentId)
    if (!agent) {
      // Memory is lost on every API restart; adopt the stored ref so local dev keeps working.
      this.agents.set(ref.agentId, { versions: [{ spec, system }], archived: false })
      return { provider: this.provider, agentId: ref.agentId, version: ref.version + 1 }
    }
    if (agent.archived) throw new RuntimeError(`Runtime agent ${ref.agentId} is archived`)
    const last = agent.versions.at(-1)
    const unchanged =
      last?.system === system &&
      last.spec.providerModelId === spec.providerModelId &&
      last.spec.effort === spec.effort &&
      last.spec.name === spec.name &&
      last.spec.description === spec.description &&
      JSON.stringify(last.spec.mcpServers) === JSON.stringify(spec.mcpServers)
    if (!unchanged) agent.versions.push({ spec, system })
    return { provider: this.provider, agentId: ref.agentId, version: agent.versions.length }
  }

  async archiveAgent(ref: RuntimeAgentRef): Promise<void> {
    this.maybeFail()
    const agent = this.agents.get(ref.agentId)
    if (agent) agent.archived = true
  }

  async ensureVault(workspaceId: string, existing?: RuntimeVaultRef): Promise<RuntimeVaultRef> {
    this.maybeFail()
    if (existing && this.vaults.has(existing.vaultId)) return existing
    const vaultId = existing?.vaultId ?? `fake_vault_${workspaceId}`
    this.vaults.set(vaultId, new Map())
    return { provider: this.provider, vaultId }
  }

  async putCredential(
    vault: RuntimeVaultRef,
    credential: McpCredential,
    existingId?: string,
  ): Promise<string> {
    this.maybeFail()
    const store = this.vaults.get(vault.vaultId)
    if (!store) throw new RuntimeError(`Unknown vault ${vault.vaultId}`)
    if (existingId) store.delete(existingId)
    const id = `fake_cred_${randomUUID()}`
    store.set(id, credential)
    return id
  }

  async deleteCredential(vault: RuntimeVaultRef, credentialId: string): Promise<void> {
    this.maybeFail()
    this.vaults.get(vault.vaultId)?.delete(credentialId)
  }
}
