# Android Lookup Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a local-first Android lookup pipeline with persistent cache, background refresh, manual lookup UI, screening integration and provider-isolated API metadata.

**Architecture:** Split Android into focused Gradle modules. Room is the source of fast local screening data; Retrofit is used only by the repository/worker outside the screening callback. The API moves number metadata behind an injected provider interface.

**Tech Stack:** Kotlin 2.2.21, Android SDK 36, Jetpack Compose, Room 2.8.4, Retrofit 3.0.0, OkHttp 5.x, WorkManager 2.11.2, Fastify 5, TypeScript 5.9, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-android-lookup-integration-design.md`

## Global Constraints

- No network I/O inside `CallScreeningService.onScreenCall`.
- Screening must fail open on cache miss, timeout, or error.
- Cache freshness default: 24 hours.
- Location is numbering/public-business metadata only, never live GPS or a residential address.
- Android modules must depend inward through model/repository contracts.
- Preserve provenance and cache timestamps end-to-end.

---

### Task 1: Android module boundaries

**Files:** `apps/android/settings.gradle.kts`, root/app Gradle files, new `core/*`, `feature/lookup`, `platform/screening` module Gradle files.

- [ ] Add module includes and shared plugin versions.
- [ ] Add focused Android/Kotlin library modules.
- [ ] Move screening ownership out of `:app`.
- [ ] Run `gradle -p apps/android test`.
- [ ] Commit `refactor: modularize Android lookup architecture`.

### Task 2: Local-first lookup data layer

**Files:** `core/model`, `core/database`, `core/network`, `core/data` sources and tests.

- [ ] Define lookup/domain and cache models.
- [ ] Add Room entity/DAO/database and mapper.
- [ ] Add Retrofit DTO/service and mapper.
- [ ] Add repository tests for fresh-cache, stale-refresh and stale fallback.
- [ ] Implement repository to satisfy tests.
- [ ] Add WorkManager refresh worker.
- [ ] Run Android tests.
- [ ] Commit `feat: add local-first Android lookup repository`.

### Task 3: Screening and lookup UI

**Files:** `platform/screening`, `feature/lookup`, `app` activity/manifest.

- [ ] Add screening decision tests for fresh hit and fail-open paths.
- [ ] Integrate local Room lookup into screening with strict timeout and no network.
- [ ] Add lookup ViewModel/UI states and manual number search screen.
- [ ] Wire app composition root.
- [ ] Run Android tests.
- [ ] Commit `feat: connect caller screening and manual lookup UI`.

### Task 4: API metadata provider boundary

**Files:** `apps/api/src/providers/*`, `apps/api/src/app.ts`, tests.

- [ ] Add failing provider injection tests.
- [ ] Define `PhoneMetadataProvider` and libphonenumber implementation.
- [ ] Inject provider into `buildApp` and preserve source evidence.
- [ ] Run Node build/tests/typecheck.
- [ ] Commit `refactor: isolate phone metadata provider`.

### Task 5: CI and documentation

**Files:** CI workflow, README, architecture docs.

- [ ] Ensure CI builds/tests Node and Android modules.
- [ ] Document local API base URL and emulator networking.
- [ ] Document cache/screening flow and privacy boundary.
- [ ] Run full CI and fix failures.
- [ ] Open stacked PR to `feat/foundation`.
