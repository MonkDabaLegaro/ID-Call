# ID-Call

ID-Call is an Android-first caller-intelligence platform focused on fast caller metadata, transparent provenance, local-first lookup, and reputation signals.

> ID-Call does **not** claim to derive a caller's live GPS position or private home address from a telephone number. Geographic information is limited to numbering metadata or explicitly public business information, and should always be shown with its precision/source.

## Current architecture

```text
apps/
  android/
    app/                      Android composition root
    core/model/               Lookup domain models
    core/database/            Room cache + evidence tables
    core/network/             Retrofit API client
    core/data/                Local-first repository + WorkManager refresh
    feature/lookup/           Compose manual lookup UI
    platform/screening/       CallScreeningService integration
  api/                        Fastify HTTP API + provider boundary
packages/
  contracts/                  Transport contracts
  phone-domain/               E.164 normalization and numbering metadata
  reputation-domain/          Reputation scoring primitives
services/
  enrichment-worker/          Provider abstraction for asynchronous enrichment
infrastructure/
  database/                   PostgreSQL schema
  docker-compose.yml          PostgreSQL + Redis local services
docs/
  architecture.md
  privacy-model.md
  superpowers/specs/
  superpowers/plans/
```

## Lookup flow

Manual lookup is local-first:

```text
UI -> LookupRepository -> Room
                      |-> fresh hit: return immediately
                      |-> stale/miss: API lookup -> persist -> return
                      |-> network error + stale cache: return stale fallback
```

Incoming-call screening is stricter:

```text
CallScreeningService -> Room only -> respond within local timeout
                                \-> schedule WorkManager refresh if stale/missing
```

The screening callback never performs network I/O and always fails open on cache miss, timeout, or error.

## API

```http
GET /health
GET /v1/lookup/:phoneNumber
```

Lookup fields include normalized E.164 number, country/region metadata, number type, reputation, evidence sources, confidence/provenance timestamps and an explicit location disclaimer.

Phone metadata is resolved through an injectable `PhoneMetadataProvider`; the current implementation wraps `libphonenumber-js`, so future providers do not need to change the HTTP route.

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

## Android development

The Android app targets API 36 with minimum API 29 and uses JDK 17 / Gradle 8.13.

```bash
gradle -p apps/android test
```

The emulator reaches the host development API at:

```text
http://10.0.2.2:3000/
```

Only the Android **debug** manifest opts into cleartext traffic for local development. Release builds keep the platform default and therefore do not inherit that local-development exception.

The app requests `ROLE_CALL_SCREENING`. Lookup cache entries are considered fresh for 24 hours. Stale entries can still be shown as an offline fallback in the manual UI, but they are not considered authoritative fresh screening data.

## Data model

A telephone number is not treated as a permanent person identifier. Public/self-claimed identity data is modeled as an expiring `identity_claim` backed by `identity_evidence`. Reputation reports are stored separately from identity claims.

On Android, lookup metadata and evidence are persisted in separate Room tables rather than serializing provenance into an opaque blob.

Persistent server deployments should lookup numbers through a server-side HMAC key instead of using raw phone numbers as primary database identifiers.

## Documentation

- `docs/architecture.md` — runtime and monorepo boundaries.
- `docs/privacy-model.md` — data/abuse constraints.
- `docs/superpowers/specs/2026-08-25-id-call-foundation-design.md` — foundation design.
- `docs/superpowers/plans/2026-08-25-id-call-foundation.md` — foundation plan.
- `docs/superpowers/specs/2026-08-25-android-lookup-integration-design.md` — local-first Android integration design.
- `docs/superpowers/plans/2026-08-25-android-lookup-integration.md` — integration plan.

## License

No license has been granted yet. Until a license is explicitly added, standard copyright protections apply to the repository content.
