# Specifica di progetto — Marketplace second-hand UAE (working name: TBD)

> Documento di riferimento per lo sviluppo. Scritto per essere il punto di partenza in Claude Code: contiene contesto di business, decisioni di prodotto, schema dati, flussi e stack tecnico.

---

## 1. Contesto e obiettivo

App mobile marketplace C2C per la compravendita di abbigliamento/accessori second-hand, modellata sul business model di Vinted, lanciata inizialmente su **Dubai e Abu Dhabi** (UAE).

### Perché questo mercato
- Vinted non opera localmente in UAE (nessuna logistica/community locale, solo uso informale di account internazionali)
- Il mercato second-hand UAE è frammentato: Dubizzle (generalista), The Luxury Closet (consignment lusso), Bazaara (P2P fashion, ~20k utenti dopo 2 anni, poi acquisita da Best Kept Shared) — nessun player ha scalato un modello P2P puro low-cost
- Alta popolazione expat, alto potere d'acquisto, alta rotazione del guardaroba, nessuna tassazione personale → incentivo a integrare reddito vendendo usato
- Mercato della contraffazione molto sviluppato → serve un sistema di fiducia/verifica differenziante

### Differenziatore chiave
Sistema di **label di verifica self-declared** per oggetti con identificativi tracciabili (seriali, date code, tag), assente nei competitor locali.

---

## 2. Decisioni di prodotto (riepilogo)

| Area | Decisione |
|---|---|
| Piattaforma | App mobile nativa: iOS (Swift/SwiftUI) + Android (Kotlin/Jetpack Compose) |
| Ordine di sviluppo | iOS come capofila (97% penetrazione iPhone in UAE), Android a seguire sullo stesso backend |
| Verifica autenticità | Self-declared dal venditore, badge "Verificato" solo per item con identificativo verificabile (formato + foto) |
| Lista brand verificabili | Ampia: lusso con serial (Hermès, Chanel, LV, Rolex...) + sneaker/streetwear con tag (Nike, Jordan, Adidas...) |
| Pagamenti | In-app con escrow (fondi bloccati fino a conferma/risoluzione) |
| Logistica MVP | Nessuna integrazione corriere automatizzata: ritiro a mano o corriere esterno prenotato manualmente dal venditore, tracking informativo |
| Dispute | Mediazione caso per caso: finestra 48h post-consegna, poi 24h di risposta venditore, poi review manuale |
| Negoziazione prezzo | Incluso nell'MVP ("fai un'offerta") |
| Filtro "solo verificati" | Filtro primario, sempre visibile nel feed di ricerca |
| Badge verificato in feed | Discreto (piccola icona), non invasivo |
| Modello acquisto | Acquisto diretto per singolo articolo (no carrello multi-item, no scorte — ogni listing è un pezzo unico) |

### Disclaimer di prodotto non negoziabile
Il badge "Verificato" **non certifica autenticità**. Certifica solo che il venditore ha fornito un codice nel formato previsto dal brand più una foto del codice stesso. Questo disclaimer deve essere:
- Visibile nel form di listing quando si attiva lo step di verifica
- Visibile sulla pagina prodotto vicino al badge
- Esplicito nei T&C

Questo è importante per la responsabilità legale della piattaforma — va validato con un legale locale prima del lancio, non è una decisione che chiudiamo solo a livello prodotto.

---

## 3. Flussi utente

### 3.1 Onboarding
Un solo account può comprare e vendere (come Vinted). Due livelli di frizione:

**Livello base (per navigare/comprare):**
1. Registrazione: email/telefono + password, o social login
2. Profilo: nome, città (Dubai/Abu Dhabi), foto profilo
3. Metodo di pagamento salvato per acquisti (carta)

**Livello venditore (attivato solo al primo tap su "Vendi"):**
4. KYC: Emirates ID + selfie liveness, tramite il flusso del provider di pagamento (MyFatoorah) — la piattaforma non gestisce direttamente i documenti d'identità, si appoggia al provider regolamentato
5. Dati di payout (IBAN o wallet)

Principio: non bloccare mai la navigazione o l'acquisto dietro KYC. La frizione pesante è isolata a chi deve incassare.

### 3.2 Listing (creazione annuncio)
1. Foto (min 1, max 8)
2. Categoria → sottocategoria
3. Brand (autocomplete) — determina se si attiva lo step di verifica
4. **Step di verifica condizionale:**
   - Se il brand è in `BRANDS` con `verification_type != none`: mostra campo codice + upload foto obbligatoria del codice/tag in-situ → se compilato e in formato valido → `verification_status = verified`
   - Se il venditore salta lo step, o il brand non è verificabile → `verification_status = unverified`
   - Disclaimer sempre visibile in questo step
5. Taglia (dipende da categoria: EU/UK/US per scarpe, S-M-L per abbigliamento, "taglia unica" per accessori)
6. Condizione: Nuovo con cartellino / Come nuovo / Buono / Discreto
7. Prezzo (con suggerimento basato su listing simili, se disponibili)
8. Descrizione libera
9. Opzioni di consegna: ritiro a mano / corriere esterno / entrambe
10. Pubblica

### 3.3 Ricerca e feed
- Feed principale con card prodotto: foto, brand, prezzo, badge verifica discreto (piccola icona)
- Filtro primario sempre visibile: "Solo verificati"
- Filtri secondari: taglia, prezzo, condizione, categoria

### 3.4 Acquisto

```
Vede prodotto
    │
    ├─ "Acquista ora" (prezzo fisso)
    │
    └─ "Fai un'offerta"
            │
            ▼
       Venditore: accetta / rifiuta / controfferta
            │
            ▼ (se accettata)
       Prezzo bloccato per il compratore, finestra 24h per pagare
       (altrimenti l'offerta scade e l'oggetto torna disponibile)
            │
            ▼
    [confluenza: acquisto diretto o offerta accettata]
            │
            ▼
    Sceglie metodo di consegna (ritiro a mano / corriere)
            │
            ▼
    Paga → fondi in escrow (stato ordine: paid_escrow)
            │
            ▼
    Venditore consegna/spedisce, inserisce tracking se corriere
            │
            ▼
    Compratore conferma ricezione (o sistema marca "delivered" da tracking)
            │
            ▼
    Finestra dispute: 48h
            │
       ┌────┴────┐
  Nessuna dispute   Dispute aperta
       │                 │
       ▼                 ▼
  Fondi rilasciati   Stato: in review
  al venditore        Venditore ha 24h per rispondere
                            │
                       ┌────┴────┐
                Non risponde   Risponde/controbatte
                       │             │
                       ▼             ▼
                Rimborso        Mediazione manuale
                automatico      (review prove/foto,
                al compratore   decisione caso per caso)
```

---

## 4. Schema dati

```
USERS
├─ id (PK)
├─ email, phone
├─ name, profile_photo_url
├─ city (enum: dubai, abu_dhabi)
├─ created_at
├─ kyc_status (enum: none, pending, verified)
├─ kyc_provider_ref_id
├─ payout_method (IBAN/wallet, nullable)
└─ rating_avg, rating_count

LISTINGS
├─ id (PK)
├─ seller_id (FK → USERS)
├─ title, description
├─ category_id (FK → CATEGORIES)
├─ brand_id (FK → BRANDS, nullable)
├─ size, condition (enum)
├─ price, currency (AED)
├─ status (enum: active, reserved, sold, removed)
├─ verification_status (enum: not_applicable, unverified, verified)
├─ verification_code
├─ verification_photo_url
├─ delivery_options (enum: hand_off, courier, both)
└─ created_at

LISTING_PHOTOS
├─ id (PK)
├─ listing_id (FK → LISTINGS)
├─ url, sort_order

BRANDS
├─ id (PK)
├─ name
├─ verification_type (enum: none, serial, tag, date_code)
└─ verification_instructions (testo dinamico per UI)

CATEGORIES
├─ id (PK), parent_id (self-FK), name

OFFERS
├─ id (PK)
├─ listing_id (FK → LISTINGS)
├─ buyer_id (FK → USERS)
├─ amount
├─ status (enum: pending, accepted, rejected, countered, expired)
├─ expires_at
└─ created_at

ORDERS
├─ id (PK)
├─ listing_id (FK → LISTINGS)
├─ buyer_id, seller_id (FK → USERS)
├─ offer_id (FK → OFFERS, nullable)
├─ final_price
├─ delivery_method (enum: hand_off, courier)
├─ delivery_address (nullable)
├─ status (enum: pending_payment, paid_escrow, shipped, delivered,
│           dispute_window, completed, disputed, refunded, cancelled)
├─ escrow_payment_ref_id
├─ delivered_at
└─ dispute_deadline_at

DISPUTES
├─ id (PK)
├─ order_id (FK → ORDERS)
├─ opened_by (FK → USERS)
├─ reason (enum: not_authentic, not_as_described, damaged, not_received, other)
├─ status (enum: open, awaiting_seller, under_review, resolved_refund, resolved_release)
├─ seller_response_deadline_at
└─ resolution_notes

REVIEWS
├─ id (PK)
├─ order_id (FK → ORDERS)
├─ reviewer_id, reviewee_id (FK → USERS)
├─ rating (1-5), comment
```

### Note implementative sullo schema
- `verification_status` vive sul listing, non sull'utente: ogni oggetto è un caso indipendente
- `BRANDS.verification_type` è dato di configurazione, non hardcoded: aggiungere un brand verificabile è un inserimento DB, non un deploy
- `OFFERS` e `ORDERS` sono separate: un'offerta accettata genera un ordine solo al pagamento effettivo entro la finestra
- `DISPUTES` separata da `ORDERS` per tenere la cronologia del caso senza appesantire gli stati dell'ordine

---

## 5. Stack tecnico

| Layer | Scelta | Note |
|---|---|---|
| iOS | Swift + SwiftUI | Capofila di sviluppo |
| Android | Kotlin + Jetpack Compose | A seguire, stesso backend |
| Backend | Node.js + NestJS + PostgreSQL | API REST modulare |
| Storage immagini | S3-compatible (AWS S3 o Cloudflare R2) | Foto prodotto + foto verifica separate dal DB |
| Pagamenti/escrow | MyFatoorah (split payout nativo, settlement AED stesso giorno) | Logica di trattenuta/rilascio fondi gestita nel nostro backend, il provider è solo motore di pagamento/split |
| Notifiche push | Firebase Cloud Messaging | iOS + Android |
| Corriere | Nessuna integrazione API nell'MVP | Tracking number inserito manualmente dal venditore, solo informativo |

### Alternative valutate e scartate per ora
- **Checkout.com**: più sofisticato per split payment/escrow, ma richiede entità con licenza AED per settlement pieno — più adatto a una fase successiva
- **Stripe**: supporto UAE meno maturo per marketplace con split payout nativo rispetto a player locali
- **React Native / Flutter**: scartati per scelta esplicita di nativo separato (qualità massima, accettato il costo di doppio sviluppo)

---

## 6. Requisiti normativi da verificare con un legale locale (non risolti in questa spec)

- Licenza e-commerce per operare come marketplace (DED Dubai / ADDED Abu Dhabi / free zone come Dubai CommerCity)
- Validazione del disclaimer "Verificato" dal punto di vista di responsabilità legale
- Conformità KYC/AML lato piattaforma anche se il KYC pesante è delegato al provider di pagamento

---

## 7. Fuori scope per l'MVP (v2+)

- Integrazione API diretta con corrieri (Careem Box / Shipox)
- Autenticazione fisica/umana o tramite servizio terzo (es. Entrupy)
- Rimborso automatico garantito dalla piattaforma (oggi: mediazione caso per caso)
- Carrello multi-articolo
- Espansione oltre Dubai/Abu Dhabi

---

## 8. Stato del progetto

Questa è la fase di specifica. Lo sviluppo (setup repo, backend, app iOS) avviene in Claude Code a partire da questo documento.
