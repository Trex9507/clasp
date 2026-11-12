import { describe, it, expect } from "vitest";
import { verify } from "./rules.js";
import { templates } from "./templates.js";

const SPEC_COPY = { ...templates.copy_inserzione, quantita: 2 };

function makeItem(testo: string) {
  return { titolo: "Test titolo", testo };
}

describe("verifier — copy_inserzione", () => {
  it("delivery valida → passed", () => {
    const result = verify(SPEC_COPY, {
      items: [
        makeItem("Scopri il servizio pensato per te. Velocità e qualità al primo posto."),
        makeItem("Non perdere questa opportunità esclusiva. Solo per i nostri clienti."),
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("parola vietata → fallisce", () => {
    const result = verify(SPEC_COPY, {
      items: [
        makeItem("Prodotto gratis per tutti i nuovi iscritti oggi."),
        makeItem("Scopri il servizio pensato per te. Velocità e qualità al primo posto."),
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("gratis"))).toBe(true);
  });

  it("item troppo corto → fallisce", () => {
    const result = verify(SPEC_COPY, {
      items: [makeItem("Corto."), makeItem("Corto.")],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("troppo corto"))).toBe(true);
  });

  it("quantità insufficiente → fallisce", () => {
    const result = verify(SPEC_COPY, {
      items: [makeItem("Scopri il servizio pensato per te. Velocità e qualità al primo posto.")],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("quantità"))).toBe(true);
  });

  it("campo mancante → fallisce", () => {
    const result = verify(SPEC_COPY, {
      items: [{ titolo: "Solo titolo" }, { titolo: "Solo titolo" }],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("testo"))).toBe(true);
  });

  it("tono → segnala needs_ai_check", () => {
    const result = verify(SPEC_COPY, {
      items: [
        makeItem("Scopri il servizio pensato per te. Velocità e qualità al primo posto."),
        makeItem("Non perdere questa opportunità esclusiva. Solo per i nostri clienti."),
      ],
    });
    expect(result.needs_ai_check).toBe(true);
  });
});

describe("verifier — traduzione", () => {
  it("testo valido → passed", () => {
    const result = verify(templates.traduzione, {
      testo: Array(120).fill("word").join(" "), // 120 parole, lingua EN
    });
    expect(result.passed).toBe(true);
  });
});

describe("verifier — ricerca_competitor", () => {
  it("delivery valida → passed", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      nome: `Competitor ${i + 1}`,
      posizionamento: Array(220).fill("parola").join(" "),
      punti_forza: "Forte brand awareness e distribuzione capillare sul mercato.",
      punti_deboli: "Prezzi alti e scarsa flessibilità nelle offerte personalizzate.",
    }));
    const result = verify(templates.ricerca_competitor, { items });
    expect(result.passed).toBe(true);
  });
});
