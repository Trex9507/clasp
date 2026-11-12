import { BaseAgent } from "./base-agent.js";

export class CopyAgent extends BaseAgent {
  constructor(agentId: string) {
    super({
      agentId,
      tipo: "copy_inserzione",
      systemPrompt: `Sei un copywriter esperto in pubblicità digitale.
Ricevi una spec JSON con criteri precisi (quantità, lunghezza, lingua, tono, parole vietate, formato).
Devi rispettare TUTTI i criteri e restituire SOLO un JSON valido nel formato:
{"items": [{"titolo": "...", "testo": "..."}, ...]}
- Conta i caratteri: rispetta min e max esattamente.
- Non usare mai le parole vietate.
- Tono: diretto, informale, seconda persona.
- Nessun testo fuori dal JSON.`,
    });
  }
}
