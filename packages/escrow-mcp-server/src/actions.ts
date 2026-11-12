import { createHash, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { verify } from "@clasp/verifier"
import { JobSpecSchema, type JobSpec, type Agent, type Job } from "./types.js"

const FEE_BPS = 250
const STAKE_REQUIRED = 5
const MAX_JOB_USDC = 100
const MAX_NEGOTIATION_ROUNDS = 3

function calcFee(amount: number): number {
  return parseFloat(((amount * FEE_BPS) / 10_000).toFixed(6))
}

function specHash(spec: JobSpec): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex")
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function getJob(db: DatabaseSync, jobId: string): Job {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Job | undefined
  if (!job) throw new Error("Job not found")
  return job
}

function getStakedProvider(db: DatabaseSync, providerId: string): Agent {
  const provider = db.prepare("SELECT * FROM agents WHERE id = ?").get(providerId) as
    Agent | undefined
  if (!provider) throw new Error("Provider not found")
  if (provider.stake_balance < STAKE_REQUIRED) {
    throw new Error(`Insufficient stake: ${STAKE_REQUIRED} USDC required`)
  }
  return provider
}

// --- 1. register -------------------------------------------------------------

export function registerAgent(
  db: DatabaseSync,
  params: { owner: string; wallet_address: string; referrer_id?: string },
): Agent {
  const id = `agent-${randomUUID()}`
  db.prepare("INSERT INTO agents (id, owner, wallet_address, referrer_id) VALUES (?, ?, ?, ?)").run(
    id,
    params.owner,
    params.wallet_address,
    params.referrer_id ?? null,
  )
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as unknown as Agent
}

// --- 2. publish --------------------------------------------------------------

export function publishJob(db: DatabaseSync, params: { buyer_id: string; spec: unknown }): Job {
  const spec = JobSpecSchema.parse(params.spec)
  if (spec.price_usdc > MAX_JOB_USDC) throw new Error(`Max ${MAX_JOB_USDC} USDC per job`)

  const buyer = db.prepare("SELECT * FROM agents WHERE id = ?").get(params.buyer_id)
  if (!buyer) throw new Error("Buyer not found")

  const id = `job-${randomUUID()}`
  db.prepare(
    `INSERT INTO jobs (id, buyer_id, spec_hash, spec_json, value_usdc, fee_usdc, status, deadline_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(
    id,
    params.buyer_id,
    specHash(spec),
    JSON.stringify(spec),
    spec.price_usdc,
    calcFee(spec.price_usdc),
    now() + spec.deadline_hours * 3600,
  )
  return getJob(db, id)
}

// --- 3. negotiate ------------------------------------------------------------

export function negotiate(
  db: DatabaseSync,
  params: { job_id: string; provider_id: string; proposed_spec: unknown },
): { accepted: boolean; job: Job; round: number } {
  const job = getJob(db, params.job_id)
  if (job.status !== "open" && job.status !== "negotiating") throw new Error("Job not available")
  getStakedProvider(db, params.provider_id)

  const currentSpec = JSON.parse(job.spec_json) as JobSpec
  const proposedSpec = JobSpecSchema.parse(params.proposed_spec)
  const accepted = JSON.stringify(currentSpec) === JSON.stringify(proposedSpec)
  const round = job.negotiation_round + 1

  db.prepare(
    "INSERT INTO negotiations (job_id, round, proposer_id, proposal_json) VALUES (?, ?, ?, ?)",
  ).run(params.job_id, round, params.provider_id, JSON.stringify(proposedSpec))

  if (accepted) {
    db.prepare(
      "UPDATE jobs SET status = 'active', provider_id = ?, negotiation_round = ? WHERE id = ?",
    ).run(params.provider_id, round, params.job_id)
  } else if (round >= MAX_NEGOTIATION_ROUNDS) {
    // No agreement after the last round: the job goes back on the board.
    db.prepare("UPDATE jobs SET status = 'open', negotiation_round = 0 WHERE id = ?").run(
      params.job_id,
    )
  } else {
    db.prepare("UPDATE jobs SET status = 'negotiating', negotiation_round = ? WHERE id = ?").run(
      round,
      params.job_id,
    )
  }

  return { accepted, job: getJob(db, params.job_id), round }
}

// --- 4. accept ---------------------------------------------------------------

export function acceptJob(db: DatabaseSync, params: { job_id: string; provider_id: string }): Job {
  const job = getJob(db, params.job_id)
  if (job.status !== "open") throw new Error("Job not available")
  getStakedProvider(db, params.provider_id)

  db.prepare("UPDATE jobs SET status = 'active', provider_id = ? WHERE id = ?").run(
    params.provider_id,
    params.job_id,
  )
  db.prepare(
    "INSERT INTO escrow_events (job_id, event_type, amount_usdc) VALUES (?, 'locked', ?)",
  ).run(params.job_id, job.value_usdc)
  return getJob(db, params.job_id)
}

// --- 5. deliver --------------------------------------------------------------

export function deliverJob(
  db: DatabaseSync,
  params: { job_id: string; provider_id: string; delivery_json: unknown },
): { job: Job; verification_passed: boolean; needs_revision: boolean; failures: string[] } {
  const job = getJob(db, params.job_id)
  // "delivered" means the first attempt failed and the free revision is pending.
  if (job.status !== "active" && job.status !== "delivered") throw new Error("Job not active")
  if (job.provider_id !== params.provider_id) throw new Error("Caller is not the job's provider")

  const spec = JSON.parse(job.spec_json) as JobSpec
  const { passed, failures } = verify(spec, params.delivery_json)
  const { n: attempts } = db
    .prepare("SELECT COUNT(*) AS n FROM verifications WHERE job_id = ?")
    .get(params.job_id) as { n: number }

  db.prepare(
    "INSERT INTO verifications (job_id, attempt, passed, failures_json) VALUES (?, ?, ?, ?)",
  ).run(params.job_id, attempts + 1, passed ? 1 : 0, JSON.stringify(failures))

  if (passed) {
    db.prepare("UPDATE jobs SET status = 'completed', completed_at = ? WHERE id = ?").run(
      now(),
      params.job_id,
    )
    db.prepare(
      "INSERT INTO escrow_events (job_id, event_type, amount_usdc) VALUES (?, 'released', ?)",
    ).run(params.job_id, job.value_usdc - job.fee_usdc)
    db.prepare("UPDATE agents SET reputation_ok = reputation_ok + 1 WHERE id = ?").run(
      params.provider_id,
    )
  } else if (attempts === 0) {
    db.prepare("UPDATE jobs SET status = 'delivered' WHERE id = ?").run(params.job_id)
  } else {
    db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(params.job_id)
    db.prepare(
      "INSERT INTO disputes (job_id, opened_by, reason) VALUES (?, ?, 'failed_verification_twice')",
    ).run(params.job_id, params.provider_id)
  }

  return {
    job: getJob(db, params.job_id),
    verification_passed: passed,
    needs_revision: !passed && attempts === 0,
    failures,
  }
}

// --- 6. dispute --------------------------------------------------------------

export function disputeJob(
  db: DatabaseSync,
  params: { job_id: string; buyer_id: string; reason: string },
): { dispute_id: number; job: Job } {
  const job = getJob(db, params.job_id)
  if (job.buyer_id !== params.buyer_id) throw new Error("Caller is not the job's buyer")
  if (!["active", "delivered", "completed"].includes(job.status))
    throw new Error("Job cannot be disputed in its current state")

  db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(params.job_id)
  const result = db
    .prepare("INSERT INTO disputes (job_id, opened_by, reason) VALUES (?, ?, ?)")
    .run(params.job_id, params.buyer_id, params.reason)

  return { dispute_id: Number(result.lastInsertRowid), job: getJob(db, params.job_id) }
}
