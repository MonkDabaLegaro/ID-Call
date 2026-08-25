# Architecture

ID-Call is an Android-first caller-intelligence monorepo.

## Runtime paths

### Incoming calls
Incoming calls enter `platform/screening`. `CallScreeningService` performs only a Room-backed lookup with a strict local timeout, responds fail-open, and may display a local notification from cached data. It never performs network I/O or reporter authentication. Stale/missing records schedule WorkManager refresh after the response.

A fresh cached verified-business identity may become the local display label, but the screening path never fetches or verifies identity during the call.

### Manual lookup and history
`feature/lookup` consumes `LookupRepository` from `core/data`. Fresh Room cache returns immediately; stale/missing data triggers Retrofit and is persisted. Successful manual lookups are recorded independently in Room history.

### Caller identity
Caller identity is independent from numbering metadata and community reputation. `CallerIdentityProvider` returns evidence-backed candidates; `CompositeCallerIdentityProvider` ranks candidates deterministically by verification state, confidence and provider order.

The initial `VerifiedBusinessIdentityProvider` reads reviewed, unexpired business claims from `BusinessIdentityRepository`. Pending, rejected and expired claims are never public lookup identities. Verification is an expiring claim, not a permanent number-to-person relationship.

Authenticated installations may submit business claims through `POST /v1/business-claims`. Claims start pending, cannot supply their own confidence or verification status, and require internal moderation. A verified claim receives server-controlled confidence `0.95` and expires after 365 days.

### Moderation
Business claims and corrections use internal moderation endpoints protected by a separate `MODERATION_TOKEN`. Moderator decisions change only the moderation state they explicitly target. Accepting a correction does not automatically rewrite reputation or identity.

### Reporter identity and reputation mutations
Reporter identity represents an app installation, not a person. `POST /v1/reporters` issues an opaque token; the server persists only its SHA-256 hash. Android lazily registers on the first reputation mutation and keeps the token in app-private storage.

A reporter has at most one report per number. Updates renew that report rather than creating additional votes. Reports expire after 180 days; withdrawal removes them from scoring immediately.

Reputation scoring weights each active report by reporter trust and a 60-day temporal half-life. It also incorporates category agreement and bounded evidence volume, so a single low-trust report cannot immediately create maximum risk. Verified business identity remains separate from behavior reputation and cannot erase spam/scam evidence.

Production composition uses PostgreSQL for reporter/reputation/correction/business-identity persistence and Redis for mutation counters. Phone correlation uses HMAC of normalized E.164 values; Redis receives reporter UUIDs plus hashed target keys.

### Cache prewarming
`CachePrewarmWorker` selects a bounded unique set of recent history and refreshes it only when network is available. This improves local screening hit rate without moving HTTP work into Telecom callbacks.

## Android module boundaries
- `app`: composition root, caller-screening role, notification permission, prewarm scheduling.
- `core:model`: lookup/history/identity structures and freshness semantics.
- `core:database`: Room cache/evidence/history plus explicit migrations; schema v3 caches nullable business identity fields.
- `core:network`: unauthenticated lookup plus explicit authenticated mutation transport.
- `core:data`: repository, Room/Retrofit adapters, reporter-session manager, refresh/prewarm workers.
- `feature:lookup`: lookup, verified-business presentation, recent history and community reporting UI.
- `platform:screening`: Telecom integration and local notification presenter; no identity-network or reporter-session dependency.

## Invariants
A phone number is not modeled as a person. Identity is an expiring evidence-backed claim. Reporter authentication proves possession of an installation token, not human identity or truthfulness. Verified business identity and reputation are separate signals. No component may turn numbering metadata into a claim of live GPS position or private residential location.