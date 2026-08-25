# Reputation, History and Screening UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent reputation reporting, Android history/cache prewarming, and local incoming-call identification UI.

**Architecture:** The API consumes a `ReputationRepository`; PostgreSQL stores HMAC-correlated reports while tests use memory. Android extends existing model/database/data/feature/platform modules rather than moving behavior back into `:app`.

**Tech Stack:** TypeScript, Fastify, PostgreSQL/pg, Kotlin, Room 2.8.4, Retrofit 3, WorkManager 2.11.2, Compose.

**Spec:** `docs/superpowers/specs/2026-08-25-reputation-history-screening-design.md`

## Global Constraints
- No network request inside `CallScreeningService.onScreenCall`.
- No exact/private-person location enrichment.
- Keep phone-number identity and reputation separate.
- Persist server number correlation using HMAC.
- Preserve stacked branch history; no squash.

---

### Task 1: Reputation repository and API
- [ ] Add repository tests for empty, submitted, and invalid category behavior.
- [ ] Add in-memory and PostgreSQL repository adapters.
- [ ] Wire lookup aggregation and `POST /v1/reports`.
- [ ] Verify Node build, tests, and typecheck.
- [ ] Commit.

### Task 2: Android history and prewarming
- [ ] Add history model/entity/DAO behavior and Room v1→v2 migration.
- [ ] Record successful lookups in history.
- [ ] Add WorkManager prewarm worker for recent history.
- [ ] Add tests for history/prewarm selection logic.
- [ ] Commit.

### Task 3: Report UI and incoming notification
- [ ] Add report DTO/API/data method and ViewModel action.
- [ ] Add recent history and controlled report actions to Compose UI.
- [ ] Add notification presenter driven only by cached screening result.
- [ ] Keep screening fail-open and local-only.
- [ ] Run Android tests and commit.

### Task 4: Documentation and CI
- [ ] Update README/architecture/env documentation.
- [ ] Run complete CI on final SHA.
- [ ] Open stacked PR against `feat/android-lookup-integration`.