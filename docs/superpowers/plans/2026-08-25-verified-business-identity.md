# Verified Business Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add moderated, evidence-backed business identity to lookup results and local Android cache while improving reputation scoring with temporal decay and agreement weighting.

**Architecture:** Reuse the existing `identity_claims` and `identity_evidence` schema through a new `BusinessIdentityRepository` and `CallerIdentityProvider` boundary. Lookup orchestration composes numbering metadata, active business identity, and community reputation independently. Android persists the selected identity in Room so call screening can remain network-free.

**Tech Stack:** Fastify 5, PostgreSQL 17, Node 24, TypeScript 5.9, Kotlin 2.2.21, Room 2.8.4, Retrofit 3.0.0, Compose, Vitest/JUnit.

**Spec:** `docs/superpowers/specs/2026-08-25-verified-business-identity-design.md`

## Global Constraints

- A phone number is never a permanent person identity.
- Only public business identity may be surfaced in this stage.
- Verified business claims expire after 365 days.
- Reporter-submitted trust/confidence/verification values are forbidden.
- `CallScreeningService` must remain local-only and fail-open.
- No people-search providers, private residential-address discovery, live GPS, contact scraping, device fingerprinting, or automated blocking.

---

### Task 1: Agreement-aware temporal reputation scoring

**Files:**
- Modify: `apps/api/src/reputation/reputation-repository.ts`
- Modify: `apps/api/src/reputation/reputation-repository.test.ts`

**Interfaces:**
- Produces: `scoreStoredReports(reports: StoredReputationReport[], now?: Date): ReputationResult`

- [ ] Write failing tests for temporal decay, category agreement, and a single low-trust report not producing maximum risk.
- [ ] Run `npm test --workspace @id-call/api -- reputation-repository.test.ts` and confirm RED.
- [ ] Implement a 60-day half-life, effective reporter-trust weight, agreement factor and volume-confidence factor.
- [ ] Run the focused tests and confirm GREEN.
- [ ] Commit `feat: improve reputation evidence scoring`.

### Task 2: Business identity repository and provider boundary

**Files:**
- Create: `apps/api/src/identity/business-identity-repository.ts`
- Create: `apps/api/src/identity/business-identity-repository.test.ts`
- Create: `apps/api/src/identity/caller-identity-provider.ts`

**Interfaces:**
- Produces: `BusinessIdentityRepository`
- Produces: `CallerIdentityProvider`
- Produces: `CompositeCallerIdentityProvider`
- Produces: `VerifiedBusinessIdentityProvider`

- [ ] Write failing tests for pending claims, verified-only lookup, 365-day expiry, rejection and deterministic provider selection.
- [ ] Run focused Vitest files and confirm RED.
- [ ] Implement in-memory repository and provider composition.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: add verified business identity domain`.

### Task 3: PostgreSQL identity persistence

**Files:**
- Create: `infrastructure/database/003_verified_business_identity.sql`
- Create: `apps/api/src/identity/postgres-business-identity-repository.ts`

**Interfaces:**
- Consumes: `BusinessIdentityRepository`
- Produces: PostgreSQL-backed business identity repository.

- [ ] Add migration fields for claimant reporter, status, public website/address, updated/moderated timestamps and indexes.
- [ ] Implement create/list/decide/active/expire operations using server-side phone HMAC correlation.
- [ ] Ensure raw phone number is never a database key.
- [ ] Commit `feat: persist moderated business identities`.

### Task 4: Business claim and moderation API

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/corrections/correction-repository.ts`
- Modify: `apps/api/src/corrections/postgres-correction-repository.ts`

**Interfaces:**
- Produces: `POST /v1/business-claims`
- Produces: `GET/PATCH /v1/moderation/business-claims`
- Produces: `GET/PATCH /v1/moderation/corrections`

- [ ] Write failing API tests for validation, reporter auth, moderator auth, verification/rejection and correction decisions.
- [ ] Confirm RED.
- [ ] Implement claim validation and moderator bearer validation.
- [ ] Extend correction repositories with moderation list/decide methods.
- [ ] Wire PostgreSQL identity repository and `MODERATION_TOKEN` in server composition.
- [ ] Confirm GREEN.
- [ ] Commit `feat: add business identity moderation API`.

### Task 5: Lookup contract and identity aggregation

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces nullable `LookupResponse.identity`.

- [ ] Write a failing lookup test proving a verified business identity appears and pending/rejected claims do not.
- [ ] Extend shared contract with `CallerIdentity`.
- [ ] Compose identity provider output into lookup and append identity provenance to `sources`.
- [ ] Confirm Node build/tests/typecheck pass.
- [ ] Commit `feat: expose verified business identity in lookup`.

### Task 6: Android identity model and Room v3 migration

**Files:**
- Modify: `apps/android/core/model/src/main/java/dev/idcall/core/model/LookupModels.kt`
- Modify: `apps/android/core/database/src/main/java/dev/idcall/core/database/LookupEntity.kt`
- Modify: `apps/android/core/database/src/main/java/dev/idcall/core/database/LookupDatabase.kt`
- Modify: `apps/android/core/data/src/main/java/dev/idcall/core/data/RoomLookupCacheDataSource.kt`
- Modify: `apps/android/core/network/src/main/java/dev/idcall/core/network/LookupDtos.kt`
- Modify: `apps/android/core/data/src/main/java/dev/idcall/core/data/RetrofitLookupRemoteDataSource.kt`

**Interfaces:**
- Produces: nullable `LookupIdentity` in `LookupRecord`.
- Produces: Room migration 2→3.

- [ ] Add model-level test for display label preferring unexpired verified business identity.
- [ ] Confirm RED.
- [ ] Add nullable identity DTO/model/entity fields.
- [ ] Add explicit Room `MIGRATION_2_3` nullable columns.
- [ ] Map network → model → Room round-trip.
- [ ] Confirm Android tests GREEN.
- [ ] Commit `feat: cache verified caller identity on Android`.

### Task 7: Android manual lookup presentation

**Files:**
- Modify: `apps/android/feature/lookup/src/main/java/dev/idcall/feature/lookup/LookupScreen.kt`

**Interfaces:**
- Consumes: `LookupRecord.identity`.

- [ ] Render a dedicated business identity card when identity exists.
- [ ] Show verification state, confidence, public website/address and expiry where available.
- [ ] Keep reputation visually separate from identity verification.
- [ ] Run Android tests.
- [ ] Commit `feat: present verified business identity in lookup UI`.

### Task 8: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/privacy-model.md`

- [ ] Document business-claim lifecycle, moderation token, expiry and identity/reputation separation.
- [ ] Run full Node install/build/test/typecheck CI-equivalent commands.
- [ ] Run `gradle -p apps/android test`.
- [ ] Fix any regression from fresh verification.
- [ ] Open/update stacked PR against `feat/reporter-trust-abuse-controls` without squash or merge.
