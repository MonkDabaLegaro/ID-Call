# Architecture

ID-Call is an Android-first caller-intelligence monorepo.

## Runtime paths

### Incoming calls
Incoming calls enter `platform/screening`. `CallScreeningService` performs only a Room-backed lookup with a strict local timeout, responds fail-open, and may display a local notification from cached data. It never performs network I/O or reporter authentication. Stale/missing records schedule WorkManager refresh after the response.

### Manual lookup and history
`feature/lookup` consumes `LookupRepository` from `core/data`. Fresh Room cache returns immediately; stale/missing data triggers Retrofit and is persisted. Successful manual lookups are recorded independently in Room history.

### Cache prewarming
`CachePrewarmWorker` selects a bounded unique set of recent history and refreshes it only when network is available. This improves local screening hit rate without moving HTTP work into Telecom callbacks.

### Reporter identity and reputation mutations
Reporter identity represents an app installation, not a person. `POST /v1/reporters` issues an opaque token; the server persists only its SHA-256 hash. Android lazily registers on the first reputation mutation and keeps the token in app-private storage.

`POST /v1/reports`, `DELETE /v1/reports/:reportId`, and `POST /v1/corrections` require bearer authentication. `ReporterRepository`, `ReputationRepository`, `CorrectionRepository`, and `ReportRateLimiter` are separate contracts so Fastify does not depend directly on PostgreSQL or Redis.

A reporter has at most one report per number. Updates renew that report rather than creating additional votes. Only creation of a distinct vote increases the accepted-report count used by the bounded trust calculation. Reports expire after 180 days; withdrawal removes them from scoring immediately.

Production composition uses PostgreSQL for reporter/reputation/correction persistence and Redis for bounded mutation counters. Tests and local unit flows use in-memory adapters. Phone correlation uses HMAC of normalized E.164 values; Redis receives only reporter UUIDs plus an already-hashed target key.

### Corrections
Correction requests are stored as `pending` moderation evidence. They do not automatically rewrite reputation, identity claims, or numbering metadata.

### Retention
`ReputationRepository.prune()` is invoked through the API CLI entrypoint rather than an in-process scheduler. A deployment can run it from cron or another scheduler without coupling background scheduling to Fastify.

### Backend metadata
Number parsing remains behind `PhoneMetadataProvider`; the default wraps `libphonenumber-js`. Provider identity is included as source evidence. Numbering geography never represents current device location.

## Android module boundaries
- `app`: composition root, caller-screening role, notification permission, prewarm scheduling.
- `core:model`: lookup/history structures and freshness semantics.
- `core:database`: Room cache/evidence/history entities, DAOs and migrations.
- `core:network`: unauthenticated lookup plus explicit authenticated mutation transport.
- `core:data`: repository, Room/Retrofit adapters, reporter-session manager, refresh/prewarm workers.
- `feature:lookup`: lookup, recent history and community reporting UI.
- `platform:screening`: Telecom integration, resolver and local notification presenter; no reporter-session dependency.

## Invariants
A phone number is not modeled as a person. Identity is an expiring evidence-backed claim. Reporter authentication proves possession of an installation token, not human identity or truthfulness. Reputation reports are claims about call behavior, not verified identity. No component may turn numbering metadata into a claim of live GPS position or private residential location.
