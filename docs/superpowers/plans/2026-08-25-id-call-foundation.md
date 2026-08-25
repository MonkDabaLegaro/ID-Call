# ID-Call Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Android-first caller-intelligence monorepo foundation.

**Architecture:** Android owns call-screening UX and a local cache; a Fastify API owns lookup orchestration and provider boundaries; pure domain packages hold phone/reputation logic; PostgreSQL and Redis are infrastructure dependencies rather than domain dependencies.

**Tech Stack:** Kotlin, Jetpack Compose, Android Telecom, Room, TypeScript, Fastify, Vitest, PostgreSQL, Redis, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-25-id-call-foundation-design.md`

## Global Constraints
- Android-first client.
- Do not claim live GPS or private residential location from a phone number.
- Every enriched field must expose provenance/confidence.
- Screening path prioritizes local cache and deterministic metadata.
- No bulk number enumeration endpoint.

---

### Task 1: Monorepo foundation
**Produces:** root workspace, shared TypeScript config, repository hygiene, CI skeleton, documentation.
- [ ] Create root workspace/config files.
- [ ] Add API/domain package directories.
- [ ] Add architecture and privacy documentation.
- [ ] Commit foundation structure.

### Task 2: Phone and reputation domains
**Produces:** `normalizePhoneNumber`, deterministic metadata contracts, reputation scoring primitives.
- [ ] Write failing domain tests.
- [ ] Implement minimal domain behavior.
- [ ] Verify tests.
- [ ] Commit domain layer.

### Task 3: Fastify lookup API
**Consumes:** phone/reputation domain APIs.
**Produces:** `/health` and `/v1/lookup/:phoneNumber`.
- [ ] Write API integration tests first.
- [ ] Implement routes and lookup orchestration.
- [ ] Verify tests.
- [ ] Commit API.

### Task 4: Persistence and local infrastructure
**Produces:** PostgreSQL schema, Redis/PostgreSQL Docker Compose, environment template.
- [ ] Add schema for numbers, claims, evidence, reports, aggregates and cache.
- [ ] Add Docker Compose and health checks.
- [ ] Document local startup.
- [ ] Commit infrastructure.

### Task 5: Android foundation
**Produces:** Compose app, screening service, Room cache boundary and lookup client interfaces.
- [ ] Add Android Gradle project and modules.
- [ ] Write cache-policy unit tests first.
- [ ] Implement cache and screening decision policy.
- [ ] Add `CallScreeningService` declaration and role request flow.
- [ ] Commit Android foundation.

### Task 6: Verification and pull request
- [ ] Add GitHub Actions for Node and Android verification.
- [ ] Run/review available CI checks.
- [ ] Review branch diff for privacy boundary and architecture consistency.
- [ ] Open PR from `feat/foundation` to `main`.
