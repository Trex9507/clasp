// Regole di verifica in codice puro — nessuna chiamata AI, costo zero.
// L'AI viene chiamata solo per "tono" (campo soggettivo), separatamente.

export interface VerificationResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
  needs_ai_check: boolean; // true se il tono deve essere valutato da un modello
}

export interface JobSpec {
  tipo: string;
  quantita: number;
  lunghezza: { min: number; max: number; unita: "caratteri" | "parole" };
  lingua?: string;
  tono?: string[];
  parole_vietate?: string[];
  formato: { tipo: string; campi?: string[] };
  scadenza_ore: number;
  prezzo_usdc: number;
}

function textLength(text: string, unita: "caratteri" | "parole"): number {
  return unita === "caratteri" ? text.length : text.trim().split(/\s+/).length;
}

function detectLanguage(text: string): string {
  // Euristica molto semplice per fase 1: conta stopword comuni.
  // In produzione si usa franc o una chiamata AI.
  const it = /\b(il|la|le|lo|gli|di|che|non|un|una|per|con|del|della|dei|è)\b/gi;
  const en = /\b(the|and|for|with|this|that|are|you|have|from|not)\b/gi;
  const itCount = (text.match(it) ?? []).length;
  const enCount = (text.match(en) ?? []).length;
  if (itCount === 0 && enCount === 0) return "unknown";
  return itCount >= enCount ? "it" : "en";
}

export function verifyItem(
  item: Record<string, unknown>,
  spec: JobSpec,
  index: number
): string[] {
  const failures: string[] = [];
  const prefix = `item[${index}]`;

  // campi richiesti
  if (spec.formato.campi) {
    for (const campo of spec.formato.campi) {
      if (!(campo in item)) {
        failures.push(`${prefix}: campo mancante "${campo}"`);
      }
    }
  }

  // lunghezza sul campo principale (testo, o il primo campo stringa)
  const testoKey = spec.formato.campi?.find((c) => ["testo", "testo_tradotto", "posizionamento", "descrizione"].includes(c)) ?? "testo";
  const testo = typeof item[testoKey] === "string" ? (item[testoKey] as string) : null;

  if (testo !== null) {
    const len = textLength(testo, spec.lunghezza.unita);
    if (len < spec.lunghezza.min) {
      failures.push(`${prefix}: ${testoKey} troppo corto (${len} ${spec.lunghezza.unita}, min ${spec.lunghezza.min})`);
    }
    if (len > spec.lunghezza.max) {
      failures.push(`${prefix}: ${testoKey} troppo lungo (${len} ${spec.lunghezza.unita}, max ${spec.lunghezza.max})`);
    }

    // parole vietate
    for (const pw of spec.parole_vietate ?? []) {
      if (testo.toLowerCase().includes(pw.toLowerCase())) {
        failures.push(`${prefix}: parola vietata "${pw}" trovata in ${testoKey}`);
      }
    }

    // lingua
    if (spec.lingua) {
      const detected = detectLanguage(testo);
      if (detected !== "unknown" && detected !== spec.lingua) {
        failures.push(`${prefix}: lingua rilevata "${detected}", attesa "${spec.lingua}"`);
      }
    }
  }

  return failures;
}

export function verify(spec: JobSpec, delivery: unknown): VerificationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return { passed: false, failures: ["delivery non è un oggetto"], warnings: [], needs_ai_check: false };
  }

  const d = delivery as Record<string, unknown>;

  // formato JSON: deve avere campo items
  if (spec.formato.tipo === "json") {
    if (!Array.isArray(d.items)) {
      failures.push('manca il campo "items" (array)');
      return { passed: false, failures, warnings, needs_ai_check: false };
    }

    const items = d.items as unknown[];

    // quantità
    if (items.length < spec.quantita) {
      failures.push(`quantità insufficiente: ${items.length} item su ${spec.quantita} richiesti`);
    }

    // verifica ogni item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        failures.push(`item[${i}] non è un oggetto`);
        continue;
      }
      failures.push(...verifyItem(item as Record<string, unknown>, spec, i));
    }
  }

  // formato testo semplice
  if (spec.formato.tipo === "testo") {
    const testo = typeof d.testo === "string" ? d.testo : null;
    if (!testo) {
      failures.push('manca il campo "testo"');
    } else {
      const len = textLength(testo, spec.lunghezza.unita);
      if (len < spec.lunghezza.min) failures.push(`testo troppo corto (${len})`);
      if (len > spec.lunghezza.max) failures.push(`testo troppo lungo (${len})`);
      for (const pw of spec.parole_vietate ?? []) {
        if (testo.toLowerCase().includes(pw.toLowerCase())) {
          failures.push(`parola vietata "${pw}"`);
        }
      }
      if (spec.lingua) {
        const detected = detectLanguage(testo);
        if (detected !== "unknown" && detected !== spec.lingua) {
          warnings.push(`lingua rilevata "${detected}", attesa "${spec.lingua}" — controllare`);
        }
      }
    }
  }

  // il tono richiede valutazione AI (segnalato ma non bloccante in fase 1)
  const needs_ai_check = (spec.tono?.length ?? 0) > 0;

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    needs_ai_check,
  };
}
