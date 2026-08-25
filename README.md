# ID-Call

ID-Call is an Android-first caller-intelligence platform focused on fast caller metadata, transparent provenance, local-first identification, lookup history, and community reputation.

> ID-Call does **not** derive a caller's live GPS position or private home address from a telephone number. Geographic information is limited to numbering metadata or explicitly public business information and must retain its precision/source.

## Current architecture

```text
apps/
  android/
    app/                      Android composition root
    core/model/               Lookup + history models
    core/database/            Room cache, evidence and history
    core/network/             Retrofit lookup/report client
    core/data/                Local-first repository + refresh/prewarm workers
    feature/lookup/           Compose lookup, history and reporting UI
    platform/screening/       CallScreeningService + local notification
  api/                        Fastify API + provider/reputation boundaries
packages/
  contracts/                  Transport contracts
  phone-domain/               E.164 normalization and numbering metadata
  reputation-domain/          Reputation scoring primitives
services/
  enrichment-worker/          Asynchronous enrichment extension point
infrastructure/
  database/                   PostgreSQL schema
  docker-compose.yml          PostgreSQL + Redis local services
```

## Runtime flows

Manual lookup is cache-first. A successful manual lookup is recorded in Room history. On startup, WorkManager prewarms a bounded set of recent numbers so incoming-call identification has useful local data before a call arrives.

Incoming-call screening is stricter:

```text
CallScreeningService -> Room only -> respond/fail-open
                                |-> cached hit: local caller notification
                                \-> stale/miss: schedule background refresh
```

The screening callback has a 350 ms local lookup budget and never performs network I/O.

## API

```http
GET  /health
GET  /v1/lookup/:phoneNumber
POST /v1/reports
```

`POST /v1/reports` accepts a phone number plus one controlled category: `spam`, `scam`, `telemarketing`, `robocall`, `debt_collection`, `legitimate_business`, or `other`. Reports are reputation evidence; they are not identity claims.

When `DATABASE_URL` and `PHONE_LOOKUP_HMAC_SECRET` are configured, the API stores reputation reports in PostgreSQL and correlates numbers using HMAC of normalized E.164 values. The HMAC secret must be at least 32 characters. Without those environment variables the API uses an in-memory reputation repository, which is intended for tests/development only.

## Local backend

Requirements: Node.js 24+, npm 11+, Docker with Compose.

```bash
npm install
docker compose -f infrastructure/docker-compose.yml up -d
npm run build
npm test
npm run dev:api
```

Example lookup/report:

```bash
curl "http://localhost:3000/v1/lookup/%2B56912345678"
curl -X POST "http://localhost:3000/v1/reports" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+56912345678","category":"spam"}'
```

## Android development

The Android app targets API 36 with minimum API 29 and uses JDK 17 / Gradle 8.13.

```bash
gradle -p apps/android test
```

The emulator reaches the host API at `http://10.0.2.2:3000/`. Only debug builds opt into cleartext traffic for this local endpoint.

The app requests `ROLE_CALL_SCREENING`; on Android 13+ it also requests notification permission when caller identification is enabled. Room schema v2 adds lookup history with an explicit v1→v2 migration. Cache entries remain fresh for 24 hours; stale data may be shown in manual offline fallback but is not used as fresh incoming-call identification.

## Data and abuse model

A telephone number is not a permanent person identifier. Public/self-claimed identity data remains an expiring claim backed by evidence. Reputation is stored separately. No live tracking, private-address discovery, contact scraping, or people-search enrichment is part of this implementation.

Before a public launch, reporting still requires authentication/rate limits, reporter-trust evolution, duplicate/brigading resistance, correction/appeal flows, and retention controls.

## Documentation

- `docs/architecture.md`
- `docs/privacy-model.md`
- `docs/superpowers/specs/2026-08-25-reputation-history-screening-design.md`
- `docs/superpowers/plans/2026-08-25-reputation-history-screening.md`

## License

No license has been granted yet. Until a license is explicitly added, standard copyright protections apply to the repository content.
