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
    core/data/                Local-first repository + reporter session + workers
    feature/lookup/           Compose lookup, history and reporting UI
    platform/screening/       CallScreeningService + local notification
  api/                        Fastify API + reputation/auth/abuse boundaries
packages/
  contracts/                  Transport contracts
  phone-domain/               E.164 normalization and numbering metadata
  reputation-domain/          Reputation scoring primitives
services/
  enrichment-worker/          Asynchronous enrichment extension point
infrastructure/
  database/                   PostgreSQL migrations
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

The screening callback has a 350 ms local lookup budget and never performs network I/O or reporter authentication.

## API

```http
GET    /health
GET    /v1/lookup/:phoneNumber
POST   /v1/reporters
POST   /v1/reports
DELETE /v1/reports/:reportId
POST   /v1/corrections
```

`POST /v1/reporters` creates a pseudonymous installation identity and returns a reporter UUID plus an opaque bearer token. Registration accepts no name, email, contact list, device phone number, advertising identifier, GPS coordinate, or caller-supplied trust value. The raw bearer token is returned to the app; persistent server storage keeps only its SHA-256 hash.

Report and correction mutations require `Authorization: Bearer <token>`. Lookup remains readable without reporter authentication.

A reporter can maintain at most one active vote for a number. Repeating a report updates the existing category and renews its 180-day expiry rather than creating another vote. Reporter trust starts at `0.25`, grows slowly from tenure and distinct accepted reports, and is capped at `0.75`; changing the same vote repeatedly does not increase accepted-report count.

Controlled report categories are `spam`, `scam`, `telemarketing`, `robocall`, `debt_collection`, `legitimate_business`, and `other`. Corrections are stored separately as pending review requests and never alter reputation automatically.

Default abuse limits are:
- 20 report mutations per reporter per hour;
- 5 report mutations per reporter/target per 24 hours;
- 10 correction requests per reporter per 24 hours.

Production uses PostgreSQL for reporters/reports/corrections and Redis for mutation counters when `DATABASE_URL`, `PHONE_LOOKUP_HMAC_SECRET`, and `REDIS_URL` are configured. Phone correlation uses server-side HMAC of normalized E.164 values. The HMAC secret must be at least 32 characters.

## Local backend

Requirements: Node.js 24+, npm 11+, Docker with Compose.

```bash
npm install
docker compose -f infrastructure/docker-compose.yml up -d
npm run build
npm test
npm run dev:api
```

Example registration and authenticated report:

```bash
curl -X POST "http://localhost:3000/v1/reporters"

curl -X POST "http://localhost:3000/v1/reports" \
  -H "Authorization: Bearer <reporter-token>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+56912345678","category":"spam"}'
```

Expired reports can be pruned by a scheduler/cron job without putting a scheduler inside the API process:

```bash
npm run retention:prune --workspace @id-call/api
```

## Android development

The Android app targets API 36 with minimum API 29 and uses JDK 17 / Gradle 8.13.

```bash
gradle -p apps/android test
```

The emulator reaches the host API at `http://10.0.2.2:3000/`. Only debug builds opt into cleartext traffic for this local endpoint.

The app requests `ROLE_CALL_SCREENING`; on Android 13+ it also requests notification permission when caller identification is enabled. Reporter registration is lazy: the app creates a pseudonymous session only when a reputation mutation is first requested. The token is stored in app-private `SharedPreferences`, is never required for lookup/screening, and is regenerated once if a mutation receives HTTP 401.

## Data and abuse model

A telephone number is not a permanent person identifier. Public/self-claimed identity data remains an expiring claim backed by evidence. Reputation is stored separately. No live tracking, private-address discovery, contact scraping, or people-search enrichment is part of this implementation.

Expired reports stop contributing after 180 days. Withdrawn reports stop contributing immediately and become eligible for physical pruning after the retention period. Correction requests require moderation; a correction is evidence for review, not verified truth.

## Documentation

- `docs/architecture.md`
- `docs/privacy-model.md`
- `docs/superpowers/specs/2026-08-25-reporter-trust-abuse-controls-design.md`
- `docs/superpowers/plans/2026-08-25-reporter-trust-abuse-controls.md`

## License

No license has been granted yet. Until a license is explicitly added, standard copyright protections apply to the repository content.
