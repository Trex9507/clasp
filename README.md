# SecondHand UAE — Marketplace C2C

Marketplace mobile C2C per abbigliamento/accessori second-hand nel mercato UAE (Dubai/Abu Dhabi), con sistema di verifica autenticità self-declared.

## Struttura

```
├── backend/     NestJS + TypeScript + PostgreSQL (Prisma ORM)
├── ios/         Swift/SwiftUI (Xcode project)
└── SPEC.md      Documento di specifica prodotto
```

## Backend — Setup locale

```bash
cd backend
cp .env.example .env        # configura DATABASE_URL con il tuo PostgreSQL
npm install
npx prisma migrate dev      # applica migrazioni
npx prisma db seed           # seed brands e categorie
npm run start:dev            # avvia su http://localhost:3000
```

Prerequisiti: Node.js 20+, PostgreSQL 15+.

## iOS — Setup locale

Apri `ios/SecondHandUAE` in Xcode. Il progetto usa SwiftUI e richiede iOS 17+.

In modalità debug, l'app si connette a `http://localhost:3000` (il backend locale).

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Backend | NestJS + Prisma + PostgreSQL |
| iOS | Swift + SwiftUI |
| Storage | S3-compatible (AWS S3 / Cloudflare R2) |
| Pagamenti | MyFatoorah (placeholder nell'MVP) |
