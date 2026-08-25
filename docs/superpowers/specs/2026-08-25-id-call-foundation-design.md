# ID-Call Foundation Design

## Goal
Build an Android-first caller-intelligence foundation that identifies and enriches phone numbers quickly enough for call screening while keeping provenance, confidence, privacy, and provider boundaries explicit.

## Product boundaries
- Android is the first supported client.
- The system may infer number-associated geography such as country, numbering region, prefix-derived locality, timezone, and publicly listed business addresses.
- The system must never claim to provide a caller's live GPS location or private residential address from a phone number.
- Every enriched field must carry source/provenance and confidence metadata.
- Caller screening must prefer local cache and deterministic metadata because Android requires a timely response.

## Architecture

### Monorepo
- `apps/android`: Kotlin + Jetpack Compose client and Android call-screening integration.
- `apps/api`: Fastify + TypeScript HTTP API.
- `packages/contracts`: shared JSON/OpenAPI contracts.
- `packages/phone-domain`: pure phone intelligence domain.
- `packages/reputation-domain`: pure reputation domain.
- `services/enrichment-worker`: future asynchronous provider enrichment boundary.
- `infrastructure`: local PostgreSQL/Redis configuration and schema.

### API modules
- lookup: resolves one E.164 number.
- providers: adapters that enrich normalized numbers.
- reputation: aggregate community/business risk metadata.
- health: service readiness.

### Data flow
1. Android receives an incoming number through `CallScreeningService`.
2. The client normalizes the number.
3. Local Room cache is checked first.
4. A fresh cache hit is rendered immediately.
5. On miss, API lookup is attempted within the remaining call-screening budget.
6. API returns normalized metadata plus provenance/confidence.
7. Android stores the result locally for future calls.
8. Slow provider enrichment remains asynchronous and must not block the screening path.

## Privacy and abuse controls
- Normalize to E.164 at the boundary.
- Do not expose bulk-enumeration endpoints.
- Rate-limit lookup endpoints before public deployment.
- Separate phone number, identity claim, evidence, and reputation rather than assuming one number permanently equals one person.
- Keep correction/opt-out support as a required product capability before public launch.

## Initial API
- `GET /health`
- `GET /v1/lookup/:phoneNumber`

Lookup response fields:
- `number`
- `valid`
- `countryCode`
- `nationalNumber`
- `regionCode`
- `location`
- `reputation`
- `sources`
- `cachedAt`

## Testing
- Unit tests for normalization and lookup orchestration.
- API integration tests for health, valid lookup, and invalid input.
- Android unit tests for cache freshness and screening decision policy.
- CI validates API tests and Android Gradle tests.
