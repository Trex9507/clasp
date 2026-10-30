"""
Simulazione dell'economia tra agenti AI — "camera di compensazione del lavoro".

Cosa simula (90 giorni, solo moneta finta):
  - agenti FORNITORI (bravi, mediocri, truffatori) che accettano lavori
  - agenti COMPRATORI che pubblicano lavori con un budget
  - ESCROW: i soldi restano bloccati finché il lavoro non è verificato
  - VERIFICA a 2 livelli: controllo automatico + revisione del compratore
  - CONTESTAZIONI risolte da un arbitro AI (costo per la piattaforma)
  - CAUZIONE (stake): il fornitore la deposita, perde una parte se consegna male
  - REPUTAZIONE: i compratori scelgono i fornitori con lo storico migliore
  - FEE della piattaforma trattenuta sul pagamento al fornitore
  - NETTING: le transazioni sulla blockchain si chiudono in un lotto al giorno

Esecuzione:  python3 simulazione.py
Nessuna libreria esterna: gira ovunque, costo zero.

ATTENZIONE: le ipotesi in CONFIG sono stime ragionevoli, non dati reali.
Servono a confrontare le regole tra loro, non a prevedere il fatturato.
"""

import math
import random
import statistics
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# IPOTESI (tutte modificabili)
# --------------------------------------------------------------------------
CONFIG = {
    "giorni": 90,
    "fornitori_iniziali": 40,
    "compratori": 60,
    "lavori_per_compratore_al_giorno": 2.0,
    "valore_lavoro_mediano": 8.0,       # USDC
    "valore_lavoro_dispersione": 0.8,   # lognormale
    # tipi di fornitore: (quota, probabilità di consegnare bene, costo come % del valore)
    "tipi": {
        "bravo":      (0.55, 0.95, (0.30, 0.70)),
        "mediocre":   (0.30, 0.70, (0.20, 0.60)),
        "truffatore": (0.15, 0.05, (0.02, 0.05)),
    },
    "verifica_automatica_scopre": 0.60,  # % di lavori scadenti bloccati in automatico
    "compratore_scopre": 0.85,           # % dei restanti scadenti che il compratore contesta
    "arbitro_accuratezza": 0.90,
    "costo_arbitro_ai": 0.03,            # USDC per contestazione (chiamata a un modello)
    "tassa_contestazione_min": 0.25,     # pagata da chi perde la contestazione
    "tassa_contestazione_pct": 0.05,
    "gas_per_tx": 0.005,                 # costo stimato di una transazione su Base
    "costo_fisso_mensile": 25.0,         # server + servizi a piano gratuito
    "nuovi_truffatori_al_giorno": 0.5,   # tentativi di ingresso
    "nuovi_onesti_al_giorno": 0.3,
    "sensibilita_truffatori_cauzione": 10.0,  # più è basso, più la cauzione li scoraggia
    "sensibilita_onesti_cauzione": 150.0,
    "abbandono_compratore_per_fregatura": 0.15,
    "giorni_per_valutare_profitto": 14,
    # ALTERNATIVA ESTERNA: ogni compratore stima il rischio di farsi fregare pagando
    # direttamente un agente (senza piattaforma). Usa la piattaforma solo se la fee
    # costa meno di quel rischio. Nello scenario "paga prima" la frode reale è ~8%.
    "rischio_percepito_min": 0.01,
    "rischio_percepito_max": 0.12,
    # quota della cauzione confiscata che va alla piattaforma (il resto rimborsa il compratore).
    # Raccomandato 0: la piattaforma non deve guadagnare dal punire, solo dal lavoro che va bene.
    "quota_piattaforma_cauzione": 0.0,
    # REGOLE AGGIORNATE
    "fee_minima": 0.05,                  # USDC per lavoro: copre verifica e gas sui lavori piccoli
    "costo_verifica": 0.01,              # USDC per controllo automatico (regole + modello AI economico)
    "revisione": True,                   # una correzione gratuita se i controlli automatici bocciano
    "revisione_min_lavori_ok": 0,        # lavori riusciti necessari per avere diritto alla revisione
    "costo_correzione_pct": 0.3,         # quanto costa al fornitore correggere (% del suo costo)
    "quota_lavori_da_referral": 0.4,     # ipotesi: 40% dei lavori arriva da agenti portati con referral
    "quota_referral": 0.005,             # 0,5 punti di fee a chi ha portato l'agente
}


@dataclass
class Fornitore:
    id: int
    tipo: str
    p_buono: float
    costo_pct: float
    cauzione: float
    ok: int = 0
    ko: int = 0
    attivo: bool = True
    profitto_recente: list = field(default_factory=list)

    def reputazione(self) -> float:
        # media bayesiana: un nuovo agente parte da 0,5
        return (self.ok + 1) / (self.ok + self.ko + 2)


@dataclass
class Compratore:
    id: int
    rischio_percepito: float = 0.0
    attivo: bool = True


def nuovo_fornitore(rnd, i, tipo, cauzione):
    _, p, (cmin, cmax) = CONFIG["tipi"][tipo]
    return Fornitore(i, tipo, p, rnd.uniform(cmin, cmax), cauzione)


def scegli_tipo(rnd):
    r, acc = rnd.random(), 0.0
    for tipo, (quota, _, _) in CONFIG["tipi"].items():
        acc += quota
        if r <= acc:
            return tipo
    return "bravo"


def simula(fee: float, cauzione: float, escrow: bool = True, netting: bool = False, seed: int = 0):
    rnd = random.Random(seed)
    C = CONFIG
    fornitori = [nuovo_fornitore(rnd, i, scegli_tipo(rnd), cauzione) for i in range(C["fornitori_iniziali"])]
    compratori = [Compratore(i, rnd.uniform(C["rischio_percepito_min"], C["rischio_percepito_max"]))
                  for i in range(C["compratori"])]

    m = dict(gmv=0.0, ricavi_fee=0.0, ricavi_contestazioni=0.0, ricavi_cauzioni=0.0,
             costi_arbitro=0.0, costi_gas=0.0, perdite_compratori=0.0,
             lavori_pubblicati=0, lavori_completati=0, lavori_senza_fornitore=0,
             lavori_persi_per_fee=0, contestazioni=0, costi_verifica=0.0, costi_referral=0.0,
             revisioni=0, revisioni_riuscite=0)

    for giorno in range(C["giorni"]):
        # ingresso di nuovi agenti: la cauzione scoraggia soprattutto i truffatori
        if rnd.random() < C["nuovi_truffatori_al_giorno"] * math.exp(-cauzione / C["sensibilita_truffatori_cauzione"]):
            fornitori.append(nuovo_fornitore(rnd, len(fornitori), "truffatore", cauzione))
        if rnd.random() < C["nuovi_onesti_al_giorno"] * math.exp(-cauzione / C["sensibilita_onesti_cauzione"]):
            fornitori.append(nuovo_fornitore(rnd, len(fornitori), rnd.choice(["bravo", "mediocre"]), cauzione))

        agenti_attivi_oggi = set()
        for comp in compratori:
            if not comp.attivo:
                continue
            n_lavori = sum(1 for _ in range(4) if rnd.random() < C["lavori_per_compratore_al_giorno"] / 4)
            for _ in range(n_lavori):
                valore = C["valore_lavoro_mediano"] * math.exp(rnd.gauss(0, C["valore_lavoro_dispersione"]))
                m["lavori_pubblicati"] += 1
                # il compratore va altrove se la fee costa più del rischio che evita
                if escrow and fee > comp.rischio_percepito:
                    m["lavori_persi_per_fee"] += 1
                    continue
                fee_importo = max(valore * fee, C["fee_minima"]) if escrow else valore * fee
                da_referral = rnd.random() < C["quota_lavori_da_referral"]
                # accetta solo chi ci guadagna dopo la fee
                candidati = [f for f in fornitori if f.attivo and valore - fee_importo > valore * f.costo_pct]
                if not candidati:
                    m["lavori_senza_fornitore"] += 1
                    continue
                # scelta per reputazione, con un po' di esplorazione per i nuovi
                pesi = [math.exp(8 * f.reputazione()) for f in candidati]
                f = rnd.choices(candidati, weights=pesi)[0]
                agenti_attivi_oggi.update({("c", comp.id), ("f", f.id)})

                buono = rnd.random() < f.p_buono
                costo_f = valore * f.costo_pct

                if not escrow:
                    # modello "paga prima" (x402 puro): nessuna protezione
                    m["gmv"] += valore
                    m["ricavi_fee"] += fee_importo
                    m["lavori_completati"] += 1
                    f.profitto_recente.append(valore - fee_importo - costo_f)
                    if buono:
                        f.ok += 1
                    else:
                        f.ko += 1
                        m["perdite_compratori"] += valore
                        if rnd.random() < C["abbandono_compratore_per_fregatura"]:
                            comp.attivo = False
                    continue

                # --- con escrow ---
                m["costi_verifica"] += C["costo_verifica"]

                def arbitrato():
                    """Contestazione decisa dall'arbitro AI. True = vince il compratore."""
                    m["contestazioni"] += 1
                    m["costi_arbitro"] += C["costo_arbitro_ai"]
                    if rnd.random() < C["arbitro_accuratezza"]:
                        tassa = max(C["tassa_contestazione_min"], valore * C["tassa_contestazione_pct"])
                        m["ricavi_contestazioni"] += tassa
                        f.profitto_recente.append(-tassa)
                        return True
                    return False

                bloccato = False
                if not buono:
                    if rnd.random() < C["verifica_automatica_scopre"]:
                        if C["revisione"] and f.ok >= C["revisione_min_lavori_ok"]:
                            # REVISIONE GRATUITA: il fornitore corregge una volta,
                            # il secondo controllo lo paga la piattaforma
                            m["revisioni"] += 1
                            m["costi_verifica"] += C["costo_verifica"]
                            costo_f += valore * f.costo_pct * C["costo_correzione_pct"]
                            buono = rnd.random() < f.p_buono
                            if buono:
                                m["revisioni_riuscite"] += 1
                            elif rnd.random() < C["verifica_automatica_scopre"]:
                                bloccato = arbitrato()
                            elif rnd.random() < C["compratore_scopre"]:
                                bloccato = arbitrato()
                        else:
                            bloccato = True
                    elif rnd.random() < C["compratore_scopre"]:
                        bloccato = arbitrato()
                if bloccato:
                    f.ko += 1
                    f.profitto_recente.append(-costo_f)
                    # cauzione: si perde l'equivalente del valore del lavoro (rimborso extra al compratore)
                    taglio = min(f.cauzione, valore)
                    f.cauzione -= taglio
                    f.profitto_recente.append(-taglio)
                    m["ricavi_cauzioni"] += taglio * C["quota_piattaforma_cauzione"]
                    if cauzione > 0 and f.cauzione < cauzione * 0.5:
                        # sotto metà cauzione: gli onesti ricaricano, i truffatori spariscono
                        if f.tipo == "truffatore":
                            f.attivo = False
                        else:
                            f.cauzione = cauzione
                    if not netting:
                        m["costi_gas"] += 2 * C["gas_per_tx"]
                    continue

                # pagamento rilasciato
                m["gmv"] += valore
                m["ricavi_fee"] += fee_importo
                if da_referral:
                    m["costi_referral"] += valore * C["quota_referral"]
                m["lavori_completati"] += 1
                f.profitto_recente.append(valore - fee_importo - costo_f)
                if buono:
                    f.ok += 1
                else:
                    f.ko += 1  # scadente ma passato: danno per il compratore
                    m["perdite_compratori"] += valore
                    if rnd.random() < C["abbandono_compratore_per_fregatura"]:
                        comp.attivo = False
                if not netting:
                    m["costi_gas"] += 2 * C["gas_per_tx"]

        if netting:
            # un solo regolamento al giorno per ogni agente che ha lavorato
            m["costi_gas"] += len(agenti_attivi_oggi) * C["gas_per_tx"]

        # i fornitori onesti che non guadagnano abbandonano
        if giorno % C["giorni_per_valutare_profitto"] == C["giorni_per_valutare_profitto"] - 1:
            for f in fornitori:
                if f.attivo and f.profitto_recente and sum(f.profitto_recente) <= 0 and f.tipo != "truffatore":
                    f.attivo = False
                f.profitto_recente = []

    mesi = C["giorni"] / 30
    m["costi_fissi"] = C["costo_fisso_mensile"] * mesi
    m["ricavi_totali"] = m["ricavi_fee"] + m["ricavi_contestazioni"] + m["ricavi_cauzioni"]
    costi_variabili = m["costi_arbitro"] + m["costi_gas"] + m["costi_verifica"] + m["costi_referral"]
    m["utile_netto"] = m["ricavi_totali"] - costi_variabili - m["costi_fissi"]
    m["utile_mensile"] = m["utile_netto"] / mesi
    m["perdite_pct_gmv"] = 100 * m["perdite_compratori"] / m["gmv"] if m["gmv"] else 0
    m["tasso_completamento"] = 100 * m["lavori_completati"] / m["lavori_pubblicati"]
    m["persi_per_fee_pct"] = 100 * m["lavori_persi_per_fee"] / m["lavori_pubblicati"]
    m["quota_ricavi_cauzioni"] = 100 * m["ricavi_cauzioni"] / m["ricavi_totali"] if m["ricavi_totali"] else 0
    m["onesti_attivi"] = sum(1 for f in fornitori if f.attivo and f.tipo != "truffatore")
    m["truffatori_attivi"] = sum(1 for f in fornitori if f.attivo and f.tipo == "truffatore")
    m["compratori_attivi"] = sum(1 for c in compratori if c.attivo)
    m["margine_per_lavoro"] = (m["ricavi_totali"] - costi_variabili) / max(1, m["lavori_completati"])
    return m


def media(fee, cauzione, escrow=True, netting=False, semi=8):
    risultati = [simula(fee, cauzione, escrow, netting, seed=s) for s in range(semi)]
    return {k: statistics.mean(r[k] for r in risultati) for k in risultati[0]}


def stampa_riga(nome, r):
    print(f"{nome:<26} GMV {r['gmv']:>8.0f}  utile/mese {r['utile_mensile']:>7.1f}  "
          f"margine/lavoro {r['margine_per_lavoro']:>5.3f}  perdite {r['perdite_pct_gmv']:>5.1f}%  "
          f"completati {r['tasso_completamento']:>5.1f}%  persi x fee {r['persi_per_fee_pct']:>5.1f}%  "
          f"da cauzioni {r['quota_ricavi_cauzioni']:>4.1f}%  compratori {r['compratori_attivi']:>4.1f}  "
          f"onesti {r['onesti_attivi']:>4.1f}  truffatori {r['truffatori_attivi']:>4.1f}")


def con(chiave, valore, fn):
    """Esegue fn con un'ipotesi di CONFIG cambiata temporaneamente."""
    vecchio = CONFIG[chiave]
    CONFIG[chiave] = valore
    try:
        return fn()
    finally:
        CONFIG[chiave] = vecchio


if __name__ == "__main__":
    FEE, CAU = 0.025, 5   # regole di lancio

    print("=== 1. Escrow contro 'paga prima' (fee 2,5%) ===")
    stampa_riga("Paga prima (x402 puro)", media(FEE, 0, escrow=False))
    stampa_riga("Escrow, senza cauzione", media(FEE, 0))
    stampa_riga("Escrow + cauzione 5", media(FEE, 5))
    stampa_riga("Escrow + cauzione 20", media(FEE, 20))

    print("\n=== 2. Revisione gratuita (fee 2,5%, cauzione 5) ===")
    senza = con("revisione", False, lambda: media(FEE, CAU))
    stampa_riga("Senza revisione", senza)
    base = media(FEE, CAU)
    stampa_riga("Con revisione gratuita", base)
    stampa_riga("Revisione dopo 10 lavori ok", con("revisione_min_lavori_ok", 10, lambda: media(FEE, CAU)))
    print(f"   revisioni al mese: {base['revisioni']/3:.0f}, riuscite: {100*base['revisioni_riuscite']/max(1,base['revisioni']):.0f}%, "
          f"costo verifiche al mese: {base['costi_verifica']/3:.1f} USDC")

    print("\n=== 3. Referral (fee 2,5%, cauzione 5) ===")
    stampa_riga("Nessun lavoro da referral", con("quota_lavori_da_referral", 0.0, lambda: media(FEE, CAU)))
    stampa_riga("40% da referral", base)
    stampa_riga("100% da referral", con("quota_lavori_da_referral", 1.0, lambda: media(FEE, CAU)))

    print("\n=== 4. Netting (fee 2,5%, cauzione 5) ===")
    stampa_riga("Senza netting", base)
    stampa_riga("Con netting", media(FEE, CAU, netting=True))

    print("\n=== 5. Livello della fee (cauzione 5, regole attuali) ===")
    griglia = []
    for fee in [0.005, 0.01, 0.02, 0.025, 0.03, 0.04, 0.05, 0.08]:
        r = media(fee, CAU)
        griglia.append((fee, r))
        stampa_riga(f"fee {fee*100:.1f}%", r)

    print("\n=== 6. Costi variabili per lavoro e sostenibilità degli sconti ===")
    costo_var = (base["costi_arbitro"] + base["costi_gas"] + base["costi_verifica"]) / base["lavori_completati"]
    valore_medio = base["gmv"] / base["lavori_completati"]
    print(f"   valore medio lavoro {valore_medio:.2f} USDC, costo variabile medio {costo_var:.3f} USDC per lavoro")
    for f_sc in [0.025, 0.02, 0.015]:
        netto = valore_medio * (f_sc - CONFIG["quota_referral"]) - costo_var
        print(f"   fee {f_sc*100:.1f}% con referral attivo -> margine medio {netto:.3f} USDC per lavoro")

    print("\n=== 7. Configurazione di lancio e scala ===")
    r = base
    print(f"fee 2,5%, cauzione 5 -> utile {r['utile_mensile']:.0f} USDC/mese, margine {r['margine_per_lavoro']:.3f} USDC/lavoro, "
          f"lavori persi per la fee {r['persi_per_fee_pct']:.0f}%, perdite compratori {r['perdite_pct_gmv']:.1f}%")
    for lavori_giorno in [100, 300, 1_000, 10_000]:
        utile = lavori_giorno * 30 * r["margine_per_lavoro"] - CONFIG["costo_fisso_mensile"]
        print(f"{lavori_giorno:>7} lavori completati/giorno -> ~{utile:>9,.0f} USDC/mese")
