import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAgent,
  publishJob,
  acceptJob,
  deliverJob,
  disputeJob,
  negotiate,
} from "./actions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(__dirname, "../../db/schema.sql");

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(SCHEMA, "utf8"));
  return db;
}

const SPEC_COPY = {
  tipo: "copy_inserzione",
  quantita: 2,
  lunghezza: { min: 40, max: 125, unita: "caratteri" },
  lingua: "it",
  tono: ["diretto"],
  parole_vietate: ["gratis"],
  formato: { tipo: "json", campi: ["titolo", "testo"] },
  scadenza_ore: 2,
  prezzo_usdc: 20,
};

describe("actions", () => {
  let db: DatabaseSync;
  let buyer: { id: string };
  let provider: { id: string };

  beforeEach(() => {
    db = makeDb();
    buyer = registerAgent(db, { owner: "alice", wallet_address: "0x01" });
    provider = registerAgent(db, { owner: "bob", wallet_address: "0x02" });
    db.prepare("UPDATE agents SET stake_balance = 5 WHERE id = ?").run(provider.id);
  });

  it("registra un agente", () => {
    assert.match(buyer.id, /^agent-/);
    assert.equal(buyer.owner, "alice");
  });

  it("pubblica un lavoro", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    assert.equal(job.status, "open");
    assert.equal(job.value_usdc, 20);
    assert.equal(job.fee_usdc, 0.5);
  });

  it("accetta un lavoro", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    const accepted = acceptJob(db, { job_id: job.id, provider_id: provider.id });
    assert.equal(accepted.status, "active");
    assert.equal(accepted.provider_id, provider.id);
  });

  it("consegna valida → completato", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    acceptJob(db, { job_id: job.id, provider_id: provider.id });

    const delivery = {
      items: [
        { titolo: "T1", testo: "Scopri il servizio pensato per te. Qualità e velocità al primo posto sempre." },
        { titolo: "T2", testo: "Non perdere questa opportunità esclusiva. Solo per i nostri clienti più fedeli." },
      ],
    };
    const result = deliverJob(db, { job_id: job.id, provider_id: provider.id, delivery_json: delivery });
    assert.equal(result.verification_passed, true);
    assert.equal(result.job.status, "completed");
  });

  it("consegna con parola vietata → revisione gratuita", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    acceptJob(db, { job_id: job.id, provider_id: provider.id });

    const delivery = {
      items: [
        { titolo: "T1", testo: "Prodotto gratis disponibile adesso per tutti i clienti nuovi del mese." },
        { titolo: "T2", testo: "Scopri il servizio pensato per te. Qualità e velocità al primo posto." },
      ],
    };
    const result = deliverJob(db, { job_id: job.id, provider_id: provider.id, delivery_json: delivery });
    assert.equal(result.verification_passed, false);
    assert.equal(result.needs_revision, true);
    assert.equal(result.job.status, "delivered");
  });

  it("contestazione aperta dal compratore", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    acceptJob(db, { job_id: job.id, provider_id: provider.id });
    const { dispute_id } = disputeJob(db, { job_id: job.id, buyer_id: buyer.id, reason: "non_come_da_spec" });
    assert.ok(dispute_id > 0);
  });

  it("negoziazione: accordo al primo giro", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    const result = negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: SPEC_COPY });
    assert.equal(result.accepted, true);
    assert.equal(result.job.status, "active");
  });

  it("negoziazione: disaccordo dopo 3 giri → lavoro torna open", () => {
    const job = publishJob(db, { buyer_id: buyer.id, spec: SPEC_COPY });
    const altSpec = { ...SPEC_COPY, prezzo_usdc: 22 };
    negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec });
    negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec });
    const last = negotiate(db, { job_id: job.id, provider_id: provider.id, proposed_spec: altSpec });
    assert.equal(last.job.status, "open");
  });
});
