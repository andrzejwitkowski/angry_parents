# Event Proof Blockchain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build versioned Polygon event proof anchoring for timeline items, with mock/local behavior, Viem-backed Amoy/Mainnet behavior, and a proof read endpoint.

**Architecture:** Timeline items remain editable, but each edit produces a new immutable proofable version snapshot stored with proof history on the event itself. A dedicated blockchain facade selects mock or Viem adapters by environment, and the timeline service publishes hashes for event versions without coupling that flow to forensic-document proofing.

**Tech Stack:** Bun, TypeScript, Elysia, Mongo/Mongoose, Viem, Vitest/Bun test

---

### Task 1: Add failing tests for timeline proof history domain behavior

Add tests for version metadata on create, proof history retention on update, and immutable version snapshots for editable events. Implement the minimal `TimelineItem` and `TimelineService` changes needed to make those tests pass.

### Task 2: Add failing tests for blockchain facade and anchor adapters

Add tests for deterministic mock publish results, Viem env validation, Amoy/Mainnet selection, receipt waiting, and `USE_MOCK_BLOCKCHAIN` factory behavior. Implement the minimal adapter and wiring changes to satisfy them.

### Task 3: Add failing tests for event proof publishing service behavior

Add tests for canonical snapshot hashing, blockchain publication, proof persistence by version, and readable failures. Implement a focused `TimelineEventProofService` plus repository methods for proof history storage.

### Task 4: Add failing tests for proof endpoint and API wiring

Add tests for `GET /api/events/:id/proof` success, missing event, and no-proof-yet cases. Wire the controller and API service to return the latest anchored proof from timeline version history.

### Task 5: Add failing e2e smoke test for proof endpoint

Add a backend e2e smoke test that creates or seeds an anchored event and verifies `GET /api/events/:id/proof` for existing and missing events. Add only minimal test-only setup helpers if required.

### Task 6: Full verification and cleanup

Run focused tests, `bun test:all`, and `bun run build`, then prepare commit, push, and PR with the completed event-proof feature.
