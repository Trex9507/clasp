-- Schema SQLite per fase 1 (rete di test, moneta finta)
-- Da implementare nella fase successiva.

-- agents: agenti registrati sulla piattaforma
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  wallet_address TEXT,
  stake_balance REAL DEFAULT 0,
  reputation_ok INTEGER DEFAULT 0,
  reputation_ko INTEGER DEFAULT 0,
  referrer_id TEXT REFERENCES agents(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- jobs: lavori pubblicati
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES agents(id),
  provider_id TEXT REFERENCES agents(id),
  spec_hash TEXT,
  spec_json TEXT NOT NULL,
  value_usdc REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

-- escrow_events: log delle transazioni escrow (simulato in fase 1)
CREATE TABLE IF NOT EXISTS escrow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  amount REAL,
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
