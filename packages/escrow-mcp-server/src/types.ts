export { JobSpecSchema, type JobSpec } from "@clasp/verifier"

export interface Agent {
  id: string
  owner: string
  wallet_address: string
  stake_balance: number
  reputation_ok: number
  reputation_ko: number
  referrer_id: string | null
}

export type JobStatus =
  "open" | "negotiating" | "active" | "delivered" | "completed" | "refunded" | "disputed"

export interface Job {
  id: string
  buyer_id: string
  provider_id: string | null
  spec_hash: string
  spec_json: string
  value_usdc: number
  fee_usdc: number
  status: JobStatus
  negotiation_round: number
  onchain_job_id: string | null
  created_at: number
  deadline_at: number | null
  completed_at: number | null
}
