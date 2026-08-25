# Architecture

ID-Call is an Android-first caller-intelligence monorepo.

## Runtime paths

### Incoming calls

Incoming calls enter `platform/screening`. `CallScreeningService` performs only a Room-backed lookup with a strict local timeout, responds fail-open, and then may display a local notification from the cached record. Network I/O is never part of the screening decision. Stale/missing records schedule WorkManager refresh after the response.

### Manual lookup and history

`feature/lookup` consumes `LookupRepository` from `core/data`. Fresh Room cache returns immediately; stale/missing data triggers Retrofit and is persisted. Successful manual lookups are recorded independently in Room history. History is schema-versioned separately from cache semantics so cache expiry does not erase recent user activity.

### Cache prewarming

`CachePrewarmWorker` reads recent history, selects a bounded unique set with `PrewarmSelector`, and refreshes those records only when network is available. This improves screening cache hit rate without putting HTTP work on the Telecom callback.

### Reputation

Fastify accepts controlled community report categories through `POST /v1/reports`. `ReputationRepository` separates orchestration from storage. Tests/development can use memory; configured runtime uses PostgreSQL. PostgreSQL correlates normalized E.164 numbers through server-side HMAC and stores reports independently of identity claims.

### Backend metadata

Number parsing remains behind `PhoneMetadataProvider`; the default wraps `libphonenumber-js`. Provider identity is included as source evidence. Numbering geography never represents current device location.

## Android module boundaries

- `app`: composition root, caller-screening role, notification permission, prewarm scheduling.
- `core:model`: lookup/history structures and freshness semantics.
- `core:database`: Room cache/evidence/history entities, DAOs and migrations.
- `core:network`: Retrofit lookup/report DTOs and service.
- `core:data`: repository, Room/Retrofit adapters, refresh and prewarm workers.
- `feature:lookup`: lookup, recent history and community reporting UI.
- `platform:screening`: Telecom integration, resolver and local notification presenter.

Feature/platform modules consume core contracts; Room and Retrofit details do not leak into Compose.

## Invariants

A phone number is not modeled as a person. Identity is an expiring evidence-backed claim. Reputation reports are claims about call behavior, not verified identity. No component may turn numbering metadata into a claim of live GPS position or private residential location.
