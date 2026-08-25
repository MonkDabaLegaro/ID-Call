# ID-Call

ID-Call is an Android-first caller-intelligence platform focused on fast caller metadata, evidence-backed public business identity, transparent provenance, local-first identification, lookup history, and community reputation.

> ID-Call does **not** derive a caller's live GPS position or private home address from a telephone number. Geographic information is limited to numbering metadata or explicitly public business information and must retain its precision/source.

## Current architecture

```text
apps/
  android/
    app/                      Android composition root
    core/model/               Lookup + history + identity models
    core/database/            Room cache, evidence and history
    core/network/             Retrofit lookup/report client
    core/data/                Local-first repository + reporter session + workers
    feature/lookup/           Compose lookup, identity, history and reporting UI
    platform/screening/       CallScreeningService + local notification
  api/                        Fastify API + identity/reputation/auth/abuse boundaries
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

Incoming-call screening remains stricter:

```text
CallScreeningService -> Room only -> respond/fail-open
                                |-> cached hit: local caller notification
                                \-> stale/miss: schedule background refresh
```

The screening callback has a 350 ms local lookup budget and never performs network I/O, moderation, or reporter authentication. A cached, unexpired verified-business identity may be used as the local display label.

## API

```http
GET    /health
GET    /v1/lookup/:phoneNumber
POST   /v1/reporters
POST   /v1/reports
DELETE /v1/reports/:reportId
POST   /v1/corrections
POST   /v1/business-claims
GET    /v1/moderation/business-claims?status=pending
PATCH  /v1/moderation/business-claims/:claimId
GET    /v1/moderation/corrections?status=pending
PATCH  /v1/moderation/corrections/:correctionId
```

`POST /v1/reporters` creates a pseudonymous installation identity and returns a reporter UUID plus an opaque bearer token. Persistent server storage keeps only its SHA-256 hash.

Report, correction and business-claim mutations require `Authorization: Bearer <reporter-token>`. Lookup remains readable without reporter authentication.

### Verified business identity

`POST /v1/business-claims` accepts a public business claim containing a telephone number, 2–120 character display name, optional HTTPS public website, and optional explicitly public business address. Claims begin `pending`; the reporter cannot submit confidence, verification state, or expiry.

Internal moderation endpoints require a separate `Authorization: Bearer <MODERATION_TOKEN>`. A verified claim receives server-controlled confidence `0.95`, expires after 365 days, and may then appear in lookup. Pending, rejected and expired claims are excluded.

Verified business identity and community reputation are independent. Verification does not erase spam/scam evidence, and a community `legitimate_business` vote cannot create a verified identity.

### Reputation

A reporter can maintain at most one active vote for a number. Repeating a report updates the existing category and renews its 180-day expiry rather than creating another vote. Reporter trust starts at `0.25`, grows slowly from tenure and distinct accepted reports, and is capped at `0.75`.

Reputation scoring applies a 60-day evidence half-life, reporter trust, category agreement and bounded evidence-volume confidence. This reduces stale influence and prevents a single low-trust report from immediately creating maximum risk.

Controlled report categories are `spam`, `scam`, `telemarketing`, `robocall`, `debt_collection`, `legitimate_business`, and `other`. Corrections are stored separately and moderation decisions do not automatically rewrite reputation or identity.

Default abuse limits are:
- 20 report mutations per reporter per hour;
- 5 report mutations per reporter/target per 24 hours;
- 10 correction/business-claim mutations per reporter per 24 hours.

Production uses PostgreSQL for reporters, reports, corrections and business identity, and Redis for mutation counters when configured. Phone correlation uses server-side HMAC of normalized E.164 values. The HMAC secret must be at least 32 characters.

## Local backend

Requirements: Node.js 24+, npm 11+, Docker with Compose.

```bash
npm install
docker compose -f infrastructure/docker-compose.yml up -d
npm run build
npm test
npm run dev:api
```

Environment variables include:

```env
DATABASE_URL=postgresql://idcall:idcall@localhost:5432/idcall
REDIS_URL=redis://localhost:6379
PHONE_LOOKUP_HMAC_SECRET=replace-with-at-least-32-characters-local-secret
MODERATION_TOKEN=replace-with-a-random-internal-moderation-token
```

Example business claim:

```bash
curl -X POST "http://localhost:3000/v1/business-claims" \
  -H "Authorization: Bearer <reporter-token>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+56912345678","displayName":"Example Business","publicWebsite":"https://example.com"}'
```

Expired reputation reports can be pruned through:

```bash
npm run retention:prune --workspace @id-call/api
```

## Android development

The Android app targets API 36 with minimum API 29 and uses JDK 17 / Gradle 8.13.

```bash
gradle -p apps/android test
```

The emulator reaches the host API at `http://10.0.2.2:3000/`. Only debug builds opt into cleartext traffic for this local endpoint.

Room schema v3 adds nullable verified-business identity fields to the lookup cache. `LookupRecord` prefers a current verified identity as its display label, then falls back to numbering metadata and finally the raw number. This means the incoming caller path can use a previously verified label without adding HTTP work to `CallScreeningService`.

## Data and abuse model

A telephone number is not a permanent person identifier. A verified-business label is an expiring public-business claim with moderation and provenance, not proof that every future call is legitimate or that a particular private person owns the number.

No live tracking, private-address discovery, contact scraping, people-search enrichment, or invasive device fingerprinting is part of this implementation.

## Documentation

- `docs/architecture.md`
- `docs/privacy-model.md`
- `docs/superpowers/specs/2026-08-25-verified-business-identity-design.md`
- `docs/superpowers/plans/2026-08-25-verified-business-identity.md`

## License

No license has been granted yet. Until a license is explicitly added, standard copyright protections apply to the repository content.
