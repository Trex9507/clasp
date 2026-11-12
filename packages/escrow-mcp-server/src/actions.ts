import { createHash, randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { JobSpecSchema, type JobSpec, type Agent, type Job } from "./types.js";

const FEE_BPS = 250;
const STAKE_REQUIRED = 5;
const MAX_JOB_USDC = 100;
const MAX_NEGOTIATION_ROUNDS = 3;

function calcFee(amount: number): number {
  return parseFloat(((amount * FEE_BPS) / 10_000).toFixed(6));
}

function specHash(spec: JobSpec): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ─── 1. registrati ───────────────────────────────────────────────────────────

export function registerAgent(
  db: DatabaseSync,
  params: { owner: string; wallet_address: string; referrer_id?: string }
): Agent {
  const id = `agent-${randomUUID()}`;
  db.prepare(`
    INSERT INTO agents (id, owner, wallet_address, referrer_id)
    VALUES (?, ?, ?, ?)
  `).run(id, params.owner, params.wallet_address, params.referrer_id ?? null);
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent;
}

// ─── 2. pubblica ─────────────────────────────────────────────────────────────

export function publishJob(
  db: DatabaseSync,
  params: { buyer_id: string; spec: unknown }
): Job {
  const spec = JobSpecSchema.parse(params.spec);
  if (spec.prezzo_usdc > MAX_JOB_USDC) throw new Error(`Max ${MAX_JOB_USDC} USDC per lavoro`);

  const buyer = db.prepare("SELECT * FROM agents WHERE id = ?").get(params.buyer_id) as Agent | undefined;
  if (!buyer) throw new Error("Compratore non trovato");

  const id = `job-${randomUUID()}`;
  const hash = specHash(spec);
  const fee = calcFee(spec.prezzo_usdc);
  const deadlineAt = now() + spec.scadenza_ore * 3600;

  db.prepare(`
    INSERT INTO jobs (id, buyer_id, spec_hash, spec_json, value_usdc, fee_usdc, status, deadline_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(id, params.buyer_id, hash, JSON.stringify(spec), spec.prezzo_usdc, fee, deadlineAt);

  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job;
}

// ─── 3. negozia ──────────────────────────────────────────────────────────────

export function negotiate(
  db: DatabaseSync,
  params: { job_id: string; provider_id: string; proposed_spec: unknown }
): { accepted: boolean; job: Job; round: number } {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job | undefined;
  if (!job) throw new Error("Lavoro non trovato");
  if (job.status !== "open" && job.status !== "negotiating") throw new Error("Lavoro non disponibile");

  const provider = db.prepare("SELECT * FROM agents WHERE id = ?").get(params.provider_id) as Agent | undefined;
  if (!provider) throw new Error("Provider non trovato");
  if (provider.stake_balance < STAKE_REQUIRED) throw new Error(`Cauzione insufficiente: richiesti ${STAKE_REQUIRED} USDC`);

  const currentSpec = JSON.parse(job.spec_json) as JobSpec;
  const proposedSpec = JobSpecSchema.parse(params.proposed_spec);
  const accepted = JSON.stringify(currentSpec) === JSON.stringify(proposedSpec);
  const round = job.negotiation_round + 1;

  db.prepare(`
    INSERT INTO negotiations (job_id, round, proposer_id, proposal_json) VALUES (?, ?, ?, ?)
  `).run(params.job_id, round, params.provider_id, JSON.stringify(proposedSpec));

  if (accepted) {
    db.prepare("UPDATE jobs SET status = 'active', provider_id = ?, negotiation_round = ? WHERE id = ?")
      .run(params.provider_id, round, params.job_id);
  } else if (round >= MAX_NEGOTIATION_ROUNDS) {
    db.prepare("UPDATE jobs SET status = 'open', negotiation_round = 0 WHERE id = ?").run(params.job_id);
  } else {
    db.prepare("UPDATE jobs SET status = 'negotiating', negotiation_round = ? WHERE id = ?").run(round, params.job_id);
  }

  return { accepted, job: db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job, round };
}

// ─── 4. prendi ───────────────────────────────────────────────────────────────

export function acceptJob(
  db: DatabaseSync,
  params: { job_id: string; provider_id: string }
): Job {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job | undefined;
  if (!job) throw new Error("Lavoro non trovato");
  if (job.status !== "open") throw new Error("Lavoro non disponibile");

  const provider = db.prepare("SELECT * FROM agents WHERE id = ?").get(params.provider_id) as Agent | undefined;
  if (!provider) throw new Error("Provider non trovato");
  if (provider.stake_balance < STAKE_REQUIRED) throw new Error(`Cauzione insufficiente: richiesti ${STAKE_REQUIRED} USDC`);

  db.prepare("UPDATE jobs SET status = 'active', provider_id = ? WHERE id = ?").run(params.provider_id, params.job_id);
  db.prepare("INSERT INTO escrow_events (job_id, event_type, amount_usdc) VALUES (?, 'locked', ?)").run(params.job_id, job.value_usdc);
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job;
}

// ─── 5. consegna ─────────────────────────────────────────────────────────────

export function deliverJob(
  db: DatabaseSync,
  params: { job_id: string; provider_id: string; delivery_json: unknown }
): { job: Job; verification_passed: boolean; needs_revision: boolean } {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job | undefined;
  if (!job) throw new Error("Lavoro non trovato");
  if (job.status !== "active") throw new Error("Lavoro non attivo");
  if (job.provider_id !== params.provider_id) throw new Error("Non sei il provider");

  const spec = JSON.parse(job.spec_json) as JobSpec;
  const { passed, failures } = verifyDelivery(spec, params.delivery_json);
  const attempts = (db.prepare("SELECT COUNT(*) as n FROM verifications WHERE job_id = ?").get(params.job_id) as { n: number }).n;

  db.prepare("INSERT INTO verifications (job_id, attempt, passed, failures_json) VALUES (?, ?, ?, ?)")
    .run(params.job_id, attempts + 1, passed ? 1 : 0, JSON.stringify(failures));

  if (passed) {
    db.prepare("UPDATE jobs SET status = 'completed', completed_at = ? WHERE id = ?").run(now(), params.job_id);
    db.prepare("INSERT INTO escrow_events (job_id, event_type, amount_usdc) VALUES (?, 'released', ?)").run(params.job_id, job.value_usdc - job.fee_usdc);
    db.prepare("UPDATE agents SET reputation_ok = reputation_ok + 1 WHERE id = ?").run(params.provider_id);
  } else if (attempts === 0) {
    db.prepare("UPDATE jobs SET status = 'delivered' WHERE id = ?").run(params.job_id);
  } else {
    db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(params.job_id);
    db.prepare("INSERT INTO disputes (job_id, opened_by, reason) VALUES (?, ?, 'failed_verification_twice')").run(params.job_id, params.provider_id);
  }

  return { job: db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job, verification_passed: passed, needs_revision: !passed && attempts === 0 };
}

// ─── 6. contesta ─────────────────────────────────────────────────────────────

export function disputeJob(
  db: DatabaseSync,
  params: { job_id: string; buyer_id: string; reason: string }
): { dispute_id: number; job: Job } {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job | undefined;
  if (!job) throw new Error("Lavoro non trovato");
  if (job.buyer_id !== params.buyer_id) throw new Error("Non sei il compratore");
  if (!["active", "delivered", "completed"].includes(job.status)) throw new Error("Stato non contestabile");

  db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(params.job_id);
  const result = db.prepare("INSERT INTO disputes (job_id, opened_by, reason) VALUES (?, ?, ?)").run(params.job_id, params.buyer_id, params.reason);

  return { dispute_id: Number(result.lastInsertRowid), job: db.prepare("SELECT * FROM jobs WHERE id = ?").get(params.job_id) as Job };
}

// ─── verifica inline ─────────────────────────────────────────────────────────

function verifyDelivery(spec: JobSpec, delivery: unknown): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (!delivery || typeof delivery !== "object") return { passed: false, failures: ["delivery non è un oggetto"] };

  const d = delivery as Record<string, unknown>;

  if (!Array.isArray(d.items)) {
    failures.push('manca il campo "items" (array)');
    return { passed: false, failures };
  }

  const items = d.items as unknown[];

  if (items.length < spec.quantita) {
    failures.push(`quantità insufficiente: ${items.length} < ${spec.quantita}`);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item !== "object" || item === null) {
      failures.push(`item[${i}] non è un oggetto`);
      continue;
    }
    const obj = item as Record<string, unknown>;

    // campi richiesti
    if (spec.formato.campi) {
      for (const campo of spec.formato.campi) {
        if (!(campo in obj)) failures.push(`item[${i}]: campo mancante "${campo}"`);
      }
    }

    // lunghezza sul campo testo principale
    const testoKey = spec.formato.campi?.find((c) => ["testo", "testo_tradotto", "posizionamento"].includes(c)) ?? "testo";
    const testo = typeof obj[testoKey] === "string" ? (obj[testoKey] as string) : null;
    if (testo !== null) {
      const len = spec.lunghezza.unita === "caratteri" ? testo.length : testo.split(/\s+/).length;
      if (len < spec.lunghezza.min) failures.push(`item[${i}]: troppo corto (${len} < ${spec.lunghezza.min})`);
      if (len > spec.lunghezza.max) failures.push(`item[${i}]: troppo lungo (${len} > ${spec.lunghezza.max})`);
      for (const pw of spec.parole_vietate ?? []) {
        if (testo.toLowerCase().includes(pw.toLowerCase())) failures.push(`item[${i}]: parola vietata "${pw}"`);
      }
    }
  }

  return { passed: failures.length === 0, failures };
}
