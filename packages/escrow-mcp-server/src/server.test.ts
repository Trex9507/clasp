import { describe, it, beforeEach, expect } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { applySchema } from "./db.js"
import {
  registerAgent,
  publishJob,
  acceptJob,
  deliverJob,
  disputeJob,
  negotiate,
} from "./actions.js"

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys = ON")
  applySchema(db)
  return db
}

const SPEC_COPY = {
  type: "listing_copy",
  quantity: 2,
  length: { min: 40, max: 125, unit: "characters" },
  language: "en",
  tone: ["direct"],
  banned_words: ["free"],
  format: { type: "json", fields: ["title", "text"] },
  deadline_hours: 2,
  price_usdc: 20,
}

const VALID_DELIVERY = {
  items: [
    { title: "T1", text: "Discover the service built for you, with speed and quality first." },
    { title: "T2", text: "Do not miss this exclusive offer, made only for our loyal clients." },
  ],
}

const BANNED_WORD_DELIVERY = {
  items: [
    { title: "T1", text: "Get the product free today, for every new subscriber we have." },
    { title: "T2", text: "Discover the service built for you, with speed and quality first." },
  ],
}

describe("escrow actions", () => {
  let db: DatabaseSync
  let buyer: { id: string; owner: string }
  let provider: { id: string }

  beforeEach(() => {
    db = makeDb()
    buyer = registerAgent(db, { owner: "alice", wallet_address: "0x01" })
    provider = registerAgent(db, { owner: "bob", wallet_address: "0x02" })
    db.prepare("UPDATE agents SET stake_balance = 5 WHERE id = ?").run(provider.id)
  })

  function activeJob() {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY })
    acceptJob(db, { job_id: job.id, provider_id: provider.id })
    return job
  }

  it("registers an agent", () => {
    expect(buyer.id).toMatch(/^agent-/)
    expect(buyer.owner).toBe("alice")
  })

  it("publishes a job with a 2.5% fee", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY })
    expect(job.status).toBe("open")
    expect(job.value_usdc).toBe(20)
    expect(job.fee_usdc).toBe(0.5)
  })

  it("rejects a provider without enough stake", () => {
    db.prepare("UPDATE agents SET stake_balance = 0 WHERE id = ?").run(provider.id)
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY })
    expect(() => acceptJob(db, { job_id: job.id, provider_id: provider.id })).toThrow(
      "Insufficient stake",
    )
  })

  it("accepts a job", () => {
    const job = activeJob()
    const row = db.prepare("SELECT status, provider_id FROM jobs WHERE id = ?").get(job.id)
    expect(row).toEqual({ status: "active", provider_id: provider.id })
  })

  it("completes a job on a valid delivery", () => {
    const job = activeJob()
    const result = deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: VALID_DELIVERY,
    })
    expect(result.verification_passed).toBe(true)
    expect(result.job.status).toBe("completed")
  })

  it("grants a free revision after a first failed delivery", () => {
    const job = activeJob()
    const result = deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: BANNED_WORD_DELIVERY,
    })
    expect(result.verification_passed).toBe(false)
    expect(result.needs_revision).toBe(true)
    expect(result.job.status).toBe("delivered")
  })

  it("completes a job when the free revision passes", () => {
    const job = activeJob()
    deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: BANNED_WORD_DELIVERY,
    })
    const result = deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: VALID_DELIVERY,
    })
    expect(result.job.status).toBe("completed")
  })

  it("opens a dispute when the revision fails too", () => {
    const job = activeJob()
    deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: BANNED_WORD_DELIVERY,
    })
    const result = deliverJob(db, {
      job_id: job.id,
      provider_id: provider.id,
      delivery_json: BANNED_WORD_DELIVERY,
    })
    expect(result.job.status).toBe("disputed")
  })

  it("lets the buyer open a dispute", () => {
    const job = activeJob()
    const { dispute_id } = disputeJob(db, {
      job_id: job.id,
      buyer_id: buyer.id,
      reason: "not_as_specified",
    })
    expect(dispute_id).toBeGreaterThan(0)
  })

  it("negotiation: agreement on the first round", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY })
    const result = negotiate(db, {
      job_id: job.id,
      provider_id: provider.id,
      proposed_spec: SPEC_COPY,
    })
    expect(result.accepted).toBe(true)
    expect(result.job.status).toBe("active")
  })

  it("negotiation: no agreement after 3 rounds reopens the job", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY })
    const altSpec = { ...SPEC_COPY, price_usdc: 22 }
    negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec })
    negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec })
    const last = negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec })
    expect(last.job.status).toBe("open")
  })
})
