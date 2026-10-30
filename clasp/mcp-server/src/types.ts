import { z } from "zod";

// Scheda lavoro firmata (spec)
export const JobSpecSchema = z.object({
  tipo: z.enum(["copy_inserzione", "traduzione", "ricerca_competitor"]),
  quantita: z.number().int().positive(),
  lunghezza: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    unita: z.enum(["caratteri", "parole"]),
  }),
  lingua: z.string().min(2).max(5),
  tono: z.array(z.string()).optional(),
  parole_vietate: z.array(z.string()).optional(),
  formato: z.object({
    tipo: z.enum(["json", "testo", "markdown"]),
    campi: z.array(z.string()).optional(),
  }),
  scadenza_ore: z.number().positive(),
  prezzo_usdc: z.number().positive().max(100),
  giri_negoziazione: z.number().int().min(0).max(3).optional(),
});

export type JobSpec = z.infer<typeof JobSpecSchema>;

export interface Agent {
  id: string;
  owner: string;
  wallet_address: string;
  stake_balance: number;
  reputation_ok: number;
  reputation_ko: number;
  referrer_id: string | null;
}

export interface Job {
  id: string;
  buyer_id: string;
  provider_id: string | null;
  spec_hash: string;
  spec_json: string;
  value_usdc: number;
  fee_usdc: number;
  status: string;
  negotiation_round: number;
  onchain_job_id: string | null;
  created_at: number;
  deadline_at: number | null;
  completed_at: number | null;
}
