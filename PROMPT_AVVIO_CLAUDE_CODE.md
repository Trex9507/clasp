# Prompt di avvio per Claude Code

> Istruzioni: apri Claude Code nella cartella dove vuoi creare il progetto, allega il file SPEC.md, poi incolla il testo qui sotto come primo messaggio.

---

Ho allegato SPEC.md, il documento di specifica completo per un'app marketplace C2C di abbigliamento/accessori second-hand per il mercato UAE (Dubai/Abu Dhabi), modellata sul business model di Vinted con un sistema differenziante di verifica autenticità self-declared.

Leggi prima tutto SPEC.md. Poi voglio che imposti il progetto da zero seguendo questo ordine, senza saltare passaggi e chiedendomi conferma prima di ogni fase:

## Fase 1 — Setup struttura repository

Crea una struttura monorepo con due cartelle principali:
- `backend/` — progetto NestJS + TypeScript + PostgreSQL (usa TypeORM o Prisma, scegli tu motivando la scelta brevemente)
- `ios/` — progetto Swift/SwiftUI (struttura base Xcode-compatibile)

Inizializza git, crea un `.gitignore` sensato per entrambi gli stack, e un `README.md` di root che spiega la struttura e come far girare backend e app in locale.

## Fase 2 — Backend: fondamenta dati

Partendo dallo schema in SPEC.md sezione 4, implementa nel backend, in quest'ordine:
1. Setup connessione PostgreSQL + migrazioni
2. Entità/modelli: `USERS`, `BRANDS`, `CATEGORIES`, `LISTINGS`, `LISTING_PHOTOS` (le tabelle che non dipendono da un ordine ancora esistente)
3. Seed iniziale per `BRANDS` con almeno questi esempi, secondo i `verification_type` descritti in SPEC.md: Hermès e Rolex (serial), Nike e Jordan (tag), Gucci (date_code), Zara e H&M (none)
4. Seed iniziale per `CATEGORIES` con una struttura a due livelli ragionevole per abbigliamento/accessori (es. Donna/Uomo → Borse, Scarpe, Abbigliamento, Accessori)

Non implementare ancora `OFFERS`, `ORDERS`, `DISPUTES`, `REVIEWS` — arriviamo a quelli dopo che le fondamenta sono solide e testate.

## Fase 3 — Backend: API REST minime

Esponi endpoint REST per:
- CRUD utenti (registrazione base, profilo)
- CRUD listing (creazione con upload foto verso storage S3-compatible — usa variabili d'ambiente per le credenziali, non hardcodare nulla)
- Lettura brand/categorie (per popolare i dropdown nel client)
- Endpoint di ricerca/feed listing con i filtri descritti in SPEC.md (inclusi taglia, prezzo, condizione, "solo verificati")

Aggiungi test automatici minimi (almeno smoke test) per ogni endpoint creato.

## Fase 4 — iOS: schermate base

Solo dopo che il backend di Fase 2-3 è funzionante e testato, crea le schermate iOS minime per:
- Onboarding base (registrazione, login)
- Feed di ricerca con filtro "solo verificati" e badge discreto sui risultati verificati
- Form di creazione listing con lo step di verifica condizionale per brand (replica la logica: se il brand selezionato ha `verification_type != none`, mostra il campo codice + upload foto + disclaimer; altrimenti salta direttamente a "non verificato")

## Istruzioni generali di lavoro

- Lavora a piccoli incrementi verificabili: dopo ogni componente significativo, fammi un breve riepilogo di cosa hai fatto e cosa resta, non aspettare la fine di una fase intera per aggiornarmi.
- Se una decisione tecnica non è specificata in SPEC.md (es. libreria specifica, convenzione di naming), scegli tu l'opzione più standard/sostenibile e motiva brevemente la scelta, senza fermarti a chiedermi ogni dettaglio minore.
- Fermati e chiedimi conferma solo per: scelte che cambiano lo schema dati descritto in SPEC.md, decisioni che comportano costi (servizi a pagamento, API key da procurarmi), o ambiguità che cambiano il comportamento del prodotto per l'utente finale.
- Non implementare ancora pagamenti/escrow (MyFatoorah), corriere, o KYC reale: per l'MVP iniziale bastano gli stub/placeholder che rispettano l'interfaccia descritta in SPEC.md, così l'architettura è pronta per collegarli in una fase successiva.

Parti dalla Fase 1.
