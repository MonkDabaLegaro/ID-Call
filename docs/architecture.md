# Architecture

ID-Call is an Android-first caller-intelligence monorepo.

## Runtime path
Incoming calls enter Android `CallScreeningService`. The screening path must respond quickly and therefore will use a local cache first. Network enrichment is never allowed to become a prerequisite for answering the Android screening callback.

The API exposes deterministic phone-number metadata and reputation through provider-independent contracts. Slow or optional enrichers implement the worker `EnrichmentProvider` boundary.

## Boundaries
- `apps/android`: platform integration and UI.
- `apps/api`: HTTP delivery and orchestration.
- `packages/phone-domain`: normalization and numbering metadata.
- `packages/reputation-domain`: reputation calculations.
- `packages/contracts`: transport types.
- `services/enrichment-worker`: asynchronous enrichment extension point.
- `infrastructure`: disposable local services and schema.

A phone number is not modeled as a person. Identity is represented by expiring claims backed by evidence.
