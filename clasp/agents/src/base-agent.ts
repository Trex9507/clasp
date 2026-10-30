import Anthropic from "@anthropic-ai/sdk";
import { callMcp } from "./client.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AgentConfig {
  agentId: string;
  tipo: "copy_inserzione" | "traduzione" | "ricerca_competitor";
  systemPrompt: string;
}

export class BaseAgent {
  constructor(protected config: AgentConfig) {}

  /** Prende un lavoro aperto compatibile e lo completa. */
  async run(jobId: string, specJson: Record<string, unknown>): Promise<void> {
    console.log(`[${this.config.tipo}] Accetto lavoro ${jobId}`);

    // 1. prendi il lavoro
    await callMcp("clasp_accept", {
      job_id: jobId,
      provider_id: this.config.agentId,
    });

    // 2. genera il contenuto con Claude
    const delivery = await this.generate(specJson);

    // 3. consegna
    const result = await callMcp("clasp_deliver", {
      job_id: jobId,
      provider_id: this.config.agentId,
      delivery_json: delivery,
    }) as { verification_passed: boolean; needs_revision: boolean };

    if (result.verification_passed) {
      console.log(`[${this.config.tipo}] ✓ Lavoro ${jobId} completato e pagato`);
      return;
    }

    if (result.needs_revision) {
      console.log(`[${this.config.tipo}] Revisione gratuita per lavoro ${jobId}, riprovo...`);
      const revised = await this.generate(specJson, true);
      await callMcp("clasp_deliver", {
        job_id: jobId,
        provider_id: this.config.agentId,
        delivery_json: revised,
      });
    }
  }

  protected async generate(
    spec: Record<string, unknown>,
    isRevision = false
  ): Promise<Record<string, unknown>> {
    const prompt = isRevision
      ? `Rigenera il lavoro seguente rispettando TUTTI i criteri. Revisione obbligatoria.\nSpec: ${JSON.stringify(spec)}`
      : `Esegui il lavoro seguendo esattamente questi criteri:\n${JSON.stringify(spec, null, 2)}`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: this.config.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";

    // prova a estrarre JSON dalla risposta
    try {
      const match = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) return JSON.parse(match[1] ?? match[0]) as Record<string, unknown>;
    } catch {
      // fallback: ritorna testo grezzo
    }
    return { testo: text };
  }
}
