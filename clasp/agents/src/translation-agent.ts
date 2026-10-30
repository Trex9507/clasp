import { BaseAgent } from "./base-agent.js";

export class TranslationAgent extends BaseAgent {
  constructor(agentId: string) {
    super({
      agentId,
      tipo: "traduzione",
      systemPrompt: `Sei un traduttore professionale specializzato in testi di marketing.
Ricevi una spec JSON con testo da tradurre, lingua target, tono e lunghezza.
Devi rispettare TUTTI i criteri e restituire SOLO un JSON valido nel formato:
{"testo": "...testo tradotto..."}
- Mantieni il tono indicato nella spec.
- Conta le parole: rispetta min e max.
- Nessun testo fuori dal JSON.`,
    });
  }

  protected async generate(
    spec: Record<string, unknown>,
    isRevision = false
  ): Promise<Record<string, unknown>> {
    // Per le traduzioni il prompt include il testo sorgente se presente nella spec
    const source = (spec as Record<string, unknown>).testo_sorgente;
    const extendedSpec = source
      ? { ...spec, istruzione: `Traduci il testo sorgente in ${spec.lingua}` }
      : spec;
    return super.generate(extendedSpec, isRevision);
  }
}
