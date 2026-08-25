# Architecture

ID-Call is an Android-first caller-intelligence monorepo.

## Runtime paths

### Incoming calls

Incoming calls enter Android `CallScreeningService` in `platform/screening`. The service reads Room-backed lookup data only and uses a strict local timeout. It never waits on HTTP before answering Android. Cache miss, timeout, or database failure all produce a fail-open response. Stale or missing records can schedule a WorkManager refresh after the screening decision.

### Manual lookup

`feature/lookup` talks to the `LookupRepository` contract in `core/data`. The default repository checks Room first. Fresh cache returns immediately; stale/missing cache triggers the Retrofit API source. Successful network results are persisted before being returned. If refresh fails and stale data exists, the stale value is returned with an explicit `STALE_CACHE` origin.

### Backend lookup

The Fastify API orchestrates numbering metadata and reputation. Number parsing lives behind `PhoneMetadataProvider`; the default implementation wraps `libphonenumber-js`. Provider identity is included in response evidence so the client can expose provenance.

## Android module boundaries

- `app`: composition root, system role request and top-level theme.
- `core:model`: stable lookup data structures and freshness semantics.
- `core:database`: Room entities, evidence relation, DAO and database lifecycle.
- `core:network`: Retrofit DTO/service and client construction.
- `core:data`: repository, Room/Retrofit adapters and WorkManager refresh.
- `feature:lookup`: manual lookup UI and presentation state.
- `platform:screening`: Telecom integration and local-only screening resolver.

Feature/platform modules consume core contracts. Retrofit and Room details do not leak into Compose UI.

## Monorepo boundaries

- `apps/android`: Android runtime and UI.
- `apps/api`: HTTP delivery and orchestration.
- `packages/phone-domain`: normalization and numbering metadata primitives.
- `packages/reputation-domain`: reputation calculations.
- `packages/contracts`: transport types.
- `services/enrichment-worker`: asynchronous enrichment extension point.
- `infrastructure`: disposable local services and schema.

## Invariants

A phone number is not modeled as a person. Identity is represented by expiring claims backed by evidence. Numbering-region metadata is not current device location. Precise live location and private residential-address discovery are outside the product boundary.
