# Android Lookup Integration Design

## Goal
Connect the Android caller-identification surface to a real local-first lookup pipeline while keeping call screening fast, offline-safe, and free of live tracking behavior.

## Scope

This stage adds:

- Room-backed lookup cache on Android.
- Retrofit client for the existing `/v1/lookup/:phoneNumber` API.
- A repository that serves fresh cache first and refreshes from the API outside the screening critical path.
- A manual lookup UI with explicit loading/error/source states.
- WorkManager-based refresh for stale cache entries.
- `CallScreeningService` integration that reads local data only and fails open on cache miss/timeouts.
- Provider interfaces on the API so numbering metadata remains replaceable and source-aware.

This stage does not add live GPS lookup, residential-address discovery, contact scraping, bulk number enumeration, or external people-search providers.

## Android Architecture

The Android project becomes a real Gradle multi-module application:

- `:app` — composition root and activity.
- `:core:model` — Android-side lookup models.
- `:core:database` — Room database, entity, DAO and database factory.
- `:core:network` — Retrofit API DTOs and service.
- `:core:data` — repository, mapping and refresh orchestration.
- `:feature:lookup` — manual lookup presentation and ViewModel.
- `:platform:screening` — `CallScreeningService` and local-only cache lookup policy.

Dependencies point inward toward model/data contracts. Feature and platform modules consume repository interfaces; they do not know Retrofit or Room implementation details.

## Data Flow

### Manual lookup

1. Repository checks Room for a fresh cached record.
2. If fresh, return it immediately.
3. If absent or stale, perform a network lookup.
4. Map the response into the domain model and persist it in Room.
5. Return the persisted/domain value with provenance and cache time.
6. A failed refresh may fall back to stale cache but must not delete usable cached data.

### Incoming call

1. `CallScreeningService` receives the call.
2. Extract the tel URI number.
3. Query Room only, with a strict sub-second timeout.
4. If a usable record exists, use its local label through the screening decision boundary.
5. Regardless of hit, miss, timeout, or error, respond before Android's screening deadline.
6. Never perform network I/O from the screening callback.
7. Background refresh is scheduled outside the callback.

## Cache Policy

A lookup is fresh for 24 hours by default. Future timestamps are rejected. Stale entries remain readable for UI fallback but are not treated as authoritative fresh screening data.

## API Provider Boundary

The API introduces a `PhoneMetadataProvider` interface and a `LibPhoneNumberMetadataProvider` implementation. The lookup route consumes the interface rather than calling `normalizePhoneNumber` directly. Every returned field retains source evidence.

## Error Handling

- Invalid phone input: API `400 INVALID_PHONE_NUMBER`; Android presents a validation message.
- Network failure: manual lookup falls back to stale cache if present, otherwise exposes a retryable error.
- Database failure: screening fails open.
- Screening timeout/cache miss: allow the call and return immediately.

## Testing

- DAO tests verify save/read and freshness-relevant timestamps.
- Repository unit tests verify fresh-cache, stale-refresh, network-failure fallback and cache write behavior.
- Screening tests verify fresh hit, stale/miss and timeout fail-open decisions.
- API tests verify provider injection and invalid-number handling.
- CI continues to require Node build/test/typecheck and Android Gradle tests.

## Privacy Boundary

Location remains numbering-region or public-business metadata only. No component may represent inferred numbering metadata as current device location, precise physical location, or a private residential address.
