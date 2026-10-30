-- Schema SQLite per fase 1 (rete di test, moneta finta)

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  stake_balance REAL NOT NULL DEFAULT 0,
  reputation_ok INTEGER NOT NULL DEFAULT 0,
  reputation_ko INTEGER NOT NULL DEFAULT 0,
  referrer_id TEXT REFERENCES agents(id),
  registered_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES agents(id),
  provider_id TEXT REFERENCES agents(id),
  spec_hash TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  value_usdc REAL NOT NULL,
  fee_usdc REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','negotiating','active','delivered','completed','refunded','disputed')),
  negotiation_round INTEGER NOT NULL DEFAULT 0,
  onchain_job_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deadline_at INTEGER,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS negotiations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  round INTEGER NOT NULL,
  proposer_id TEXT NOT NULL REFERENCES agents(id),
  proposal_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  attempt INTEGER NOT NULL DEFAULT 1,
  passed INTEGER NOT NULL DEFAULT 0,
  failures_json TEXT,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  opened_by TEXT NOT NULL REFERENCES agents(id),
  reason TEXT,
  ai_verdict TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS escrow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  amount_usdc REAL,
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
