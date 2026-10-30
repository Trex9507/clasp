// Tre schede modello per la fase 1.
// Il compratore parte da queste; il provider può proporre modifiche (max 3 campi).

export const templates = {
  copy_inserzione: {
    tipo: "copy_inserzione",
    quantita: 30,
    lunghezza: { min: 40, max: 125, unita: "caratteri" },
    lingua: "it",
    tono: ["diretto", "informale", "seconda persona"],
    parole_vietate: ["gratis", "garantito", "miracoloso"],
    formato: { tipo: "json", campi: ["titolo", "testo"] },
    scadenza_ore: 2,
    prezzo_usdc: 20,
  },

  traduzione: {
    tipo: "traduzione",
    quantita: 1,
    lunghezza: { min: 100, max: 5000, unita: "parole" },
    lingua: "en",         // lingua target
    tono: ["formale"],
    parole_vietate: [],
    formato: { tipo: "testo" },
    scadenza_ore: 4,
    prezzo_usdc: 15,
  },

  ricerca_competitor: {
    tipo: "ricerca_competitor",
    quantita: 5,          // numero di competitor analizzati
    lunghezza: { min: 200, max: 800, unita: "parole" },
    lingua: "it",
    tono: ["analitico"],
    parole_vietate: [],
    formato: { tipo: "json", campi: ["nome", "posizionamento", "punti_forza", "punti_deboli"] },
    scadenza_ore: 8,
    prezzo_usdc: 25,
  },
} as const;

export type TemplateKey = keyof typeof templates;
