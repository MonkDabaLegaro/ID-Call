# ID-Call

ID-Call is an Android-first caller-intelligence platform focused on fast caller metadata, transparent provenance, and reputation signals.

> ID-Call does **not** claim to derive a caller's live GPS position or private home address from a telephone number. Geographic information is limited to numbering metadata or explicitly public business information, and should always be shown with its precision/source.

## Foundation status

The first implementation lives on `feat/foundation` and is intentionally split into independent boundaries:

```text
apps/
  android/                  Kotlin + Jetpack Compose + CallScreeningService
  api/                      Fastify HTTP API
packages/
  contracts/                Transport contracts
  phone-domain/             E.164 normalization and numbering metadata
  reputation-domain/        Reputation scoring primitives
services/
  enrichment-worker/        Provider abstraction for asynchronous enrichment
infrastructure/
  database/                 PostgreSQL schema
  docker-compose.yml        PostgreSQL + Redis local services
docs/
  architecture.md
  privacy-model.md
  superpowers/specs/
  superpowers/plans/
```

## API

```http
GET /health
GET /v1/lookup/:phoneNumber
```

Example lookup fields include normalized E.164 number, country/region metadata, number type, reputation, evidence sources, confidence/provenance timestamps and an explicit location disclaimer.

## Local backend

Requirements: Node.js 24+, npm 11+, Docker with Compose.

```bash
npm install
docker compose -f infrastructure/docker-compose.yml up -d
npm run build
npm test
npm run dev:api
```

Then query:

```bash
curl "http://localhost:3000/v1/lookup/%2B56912345678"
```

## Android

The Android app targets API 36 with a minimum API 29. It requests the system `ROLE_CALL_SCREENING` role and declares an `android.telecom.CallScreeningService`.

The foundation screening service is deliberately fail-open and does not perform network I/O during the callback. The next implementation layer will connect it to a local lookup repository/cache before any asynchronous network refresh is attempted.

From `apps/android`, use Gradle 8.13 / JDK 17:

```bash
gradle test
```

## Data model

A telephone number is not treated as a permanent person identifier. Public/self-claimed identity data is modeled as an expiring `identity_claim` backed by `identity_evidence`. Reputation reports are stored separately from identity claims.

Persistent deployments should lookup numbers through a server-side HMAC key instead of using raw phone numbers as primary database identifiers.

## Documentation

- `docs/architecture.md` — runtime and monorepo boundaries.
- `docs/privacy-model.md` — data/abuse constraints.
- `docs/superpowers/specs/2026-08-25-id-call-foundation-design.md` — approved foundation design.
- `docs/superpowers/plans/2026-08-25-id-call-foundation.md` — implementation plan.

## License

No license has been granted yet. Until a license is explicitly added, standard copyright protections apply to the repository content.
