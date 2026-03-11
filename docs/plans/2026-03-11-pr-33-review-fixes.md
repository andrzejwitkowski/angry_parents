# PR 33 Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make event-proof publication idempotent under concurrency, restore the legacy send-only forensic anchoring behavior, and resolve the last three Copilot review comments on PR #33.

**Architecture:** Keep the blockchain adapter split by responsibility: `publishHash()` remains the event-proof path that waits for a receipt, while `anchorHash()` preserves the legacy forensic contract by only sending the transaction. Move proof reservation semantics into the repository port so the application service can atomically claim a pending publication slot before calling the blockchain adapter, then merge the finalized proof back into the same history entry.

**Tech Stack:** Bun, TypeScript, Vitest, bun:test, Mongoose, MongoDB Memory Server, viem.

---

### Task 1: Add failing tests for idempotent proof claiming

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Modify: `backend/src/domain/events/ports/TimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts`

**Step 1: Write the failing test**

Add a service-level test that simulates an already-claimed pending proof for the current `(item, version, hash)` and verifies a second `publishProof()` call does not invoke `blockchainAnchor.publishHash()` and throws the pending-publication error. Add a second test that proves the first caller can still finalize the proof by completing the claimed record.

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: FAIL because the repository port has no atomic claim API and the service still relies on non-atomic read-then-append behavior.

**Step 3: Write minimal implementation support in test doubles**

Extend the repository port and in-memory repository with an atomic-style `claimPendingProofRecord(...)` method returning whether the caller won the claim, plus the current item state needed by the service tests.

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: PASS for the new tests once the service uses the new claim flow.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/domain/events/ports/TimelineRepository.ts backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts
git commit -m "test: cover idempotent event proof claims"
```

### Task 2: Add failing tests for Mongo atomic proof reservation

**Files:**
- Modify: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts`

**Step 1: Write the failing test**

Add repository tests covering two cases: first claim inserts a pending proof exactly once for `(id, version, hash)`, and a second claim for the same tuple reports that the caller lost without pushing a duplicate proof entry. Keep assertions on stored `proofHistory` length and contents.

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: FAIL because `MongoTimelineRepository` does not yet expose or implement an atomic claim method.

**Step 3: Write minimal implementation**

Implement `claimPendingProofRecord(...)` in the Mongo adapter with one conditional `findOneAndUpdate`/`$push` operation guarded by `id`, `version`, and absence of the same hash in the target `proofHistory`, then return whether the caller created the pending marker or an existing record already won.

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: PASS with a single proof entry stored for duplicate claims.

**Step 5: Commit**

```bash
git add backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts
git commit -m "fix: make event proof reservation atomic"
```

### Task 3: Restore send-only legacy anchorHash behavior

**Files:**
- Modify: `backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
- Modify: `backend/src/adapters/blockchain/ViemBlockchainAnchor.ts`

**Step 1: Write the failing test**

Add a targeted assertion that `anchorHash()` only calls `sendTransaction()` and returns the tx hash without calling `waitForTransactionReceipt()`, while `publishHash()` still waits for the receipt and returns `blockNumber`.

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
Expected: FAIL because `anchorHash()` currently delegates to `publishHash()` and waits for the receipt.

**Step 3: Write minimal implementation**

Extract the shared send logic into a helper if useful, but keep behavior explicit: `publishHash()` sends then waits; `anchorHash()` sends and returns immediately.

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
Expected: PASS with legacy forensic behavior restored.

**Step 5: Commit**

```bash
git add backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts backend/src/adapters/blockchain/ViemBlockchainAnchor.ts
git commit -m "fix: restore legacy forensic anchor flow"
```

### Task 4: Update the service to use atomic claim + finalize flow

**Files:**
- Modify: `backend/src/domain/events/service/TimelineEventProofService.ts`
- Modify: `backend/src/domain/events/ports/TimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts`

**Step 1: Write the failing test**

Use the tests from Tasks 1-2 as the red phase and confirm they still capture the intended race condition and duplicate-insert regression.

**Step 2: Run tests to verify they fail for the right reason**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: FAIL only on the new atomic claim expectations.

**Step 3: Write minimal implementation**

Change the service flow to:
1. load and hash the requested version snapshot,
2. return an existing confirmed proof if present,
3. reject or retry an existing pending proof as before,
4. atomically claim the pending marker through the repository,
5. only the winning caller proceeds to `publishHash()`,
6. merge the finalized proof back with `appendProofRecord()`.

**Step 4: Run tests to verify they pass**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/TimelineEventProofService.ts backend/src/domain/events/ports/TimelineRepository.ts backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts
git commit -m "fix: prevent duplicate event proof publication"
```

### Task 5: Verify end-to-end and reply on PR threads

**Files:**
- Verify: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Verify: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
- Verify: `backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
- Reply in GitHub threads for review comment IDs `2916193083`, `2916193118`, `2916193125`

**Step 1: Run focused tests**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
Expected: PASS.

**Step 2: Run required repo verification**

Run: `bun test:all`
Expected: PASS for the full suite required by repo rules.

**Step 3: Build/inspect project validity**

Run the project build or IDE build for edited files.
Expected: no TypeScript or inspection errors in touched files.

**Step 4: Reply to Copilot review threads**

Reply in each GitHub thread with a factual resolution note:
- service race fixed by atomic pending-proof claim before publish,
- repository duplicate insert fixed with conditional claim update,
- legacy `anchorHash()` restored to send-only while `publishHash()` still waits for receipt.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/TimelineEventProofService.ts backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts backend/src/adapters/blockchain/ViemBlockchainAnchor.ts backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts
git commit -m "fix: address event proof review feedback"
```
