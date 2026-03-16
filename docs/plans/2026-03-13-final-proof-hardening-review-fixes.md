# Final Proof Hardening Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the final proof-hardening review blockers so timeline proof reads are version-correct, idempotent create recovers safely on standalone Mongo, and durable scheduling preserves proof-recovery metadata and retry policy.

**Architecture:** Keep the existing hexagonal split: fix orchestration in domain services, push retry-policy/state transport through outbox and scheduler ports, and remove scheduler/domain coupling by injecting final-failure handling instead of constructing domain services inside `TaskManager`.

**Tech Stack:** Bun, TypeScript, Vitest, bun:test, Mongo/Mongoose, existing ports-and-adapters structure.

---

### Task 1: Make proof reads version-strict

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`
- Modify: `backend/src/domain/events/service/TimelineApiService.ts`

**Step 1: Write the failing test**
- Add a test where version 1 is confirmed but the latest version has an empty `proofHistory`.

**Step 2: Run test to verify it fails**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`
- Expected: the new test fails because the API incorrectly falls back to an older version.

**Step 3: Write minimal implementation**
- Change `getEventProof()` to read only the latest version entry.
- If the latest version has no proof records, return the existing `proof not found` error.

**Step 4: Run test to verify it passes**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`
- Expected: PASS.

### Task 2: Prevent idempotency poisoning on standalone Mongo

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Modify: `backend/src/domain/events/ports/TimelineMutationRequestRepository.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTimelineMutationRequestRepository.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineMutationRequestRepository.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
- Modify: `backend/src/domain/events/service/TimelineService.ts`

**Step 1: Write the failing tests**
- Add a service test that simulates: mutation request claim saved, item save fails once, retry succeeds.
- Add repository tests that prove saving the same idempotency key can advance state from `IN_PROGRESS` to `COMPLETED`.

**Step 2: Run tests to verify they fail**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
- Expected: FAIL because current flow permanently poisons the idempotency key.

**Step 3: Write minimal implementation**
- Claim mutation requests as `IN_PROGRESS` before item persistence.
- Use deterministic timeline item ID for idempotent creates.
- Make mutation-request persistence upsert/replace by `idempotencyKey` so the same request can be finalized to `COMPLETED` with `timelineItemId` after the item save succeeds.
- On retry, if request hash matches and the deterministic item already exists, replay it.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
- Expected: PASS.

### Task 3: Preserve retry policy and tx-hash recovery through the durable outbox

**Files:**
- Modify: `backend/src/domain/shared/ports/TaskOutboxRepository.ts`
- Modify: `backend/src/adapters/mongo/models/TaskOutboxModel.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTaskOutboxRepository.ts`
- Modify: `backend/src/adapters/mongo/repositories/shared/MongoTaskOutboxRepository.ts`
- Modify: `backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts`
- Modify: `backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts`
- Modify: `backend/src/domain/events/service/TimelineService.ts`
- Modify: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Modify: `backend/src/domain/events/service/EventProofReconciliationService.ts`
- Modify: `backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts`

**Step 1: Write the failing tests**
- Add dispatcher tests that require forwarding `retryPolicy` into `taskManager.schedule()`.
- Add reconciliation tests that require persisting `submittedTxHash` when receipt lookup is still missing but only the payload carries the tx hash.
- Add timeline-service tests ensuring update/delete do not double-schedule direct proof tasks when outbox is enabled.

**Step 2: Run tests to verify they fail**
- Run: `bun test backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Expected: FAIL.

**Step 3: Write minimal implementation**
- Add optional `retryPolicy` to outbox records and append inputs.
- Persist retry policy for forensic and proof tasks and have the dispatcher pass it through.
- Remove competing direct proof scheduling in update/delete when outbox is present.
- When reconciliation receives an out-of-band `submittedTxHash`, persist it onto the proof record before returning a still-pending state.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Expected: PASS.

### Task 4: Decouple reconciliation final-failure handling from TaskManager

**Files:**
- Modify: `backend/src/scheduler/TaskManager.ts`
- Modify: `backend/src/config/registerSchedulerHandlers.ts`
- Modify: `backend/src/config/__tests__/registerSchedulerHandlers.test.ts`
- Modify: `backend/src/scheduler/__tests__/TaskManager.test.ts`
- Modify: `backend/src/domain/events/service/EventProofReconciliationService.ts`
- Modify: `backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts`

**Step 1: Write the failing tests**
- Add a scheduler test that proves final reconciliation failure uses an injected handler instead of constructing domain services internally.
- Add a reconciliation-service test that final failure preserves `submittedTxHash` from task payload.

**Step 2: Run tests to verify they fail**
- Run: `bun test backend/src/scheduler/__tests__/TaskManager.test.ts backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts`
- Expected: FAIL.

**Step 3: Write minimal implementation**
- Add failure-handler registration to `TaskManager`.
- Register a reconciliation final-failure callback from wiring/handler registration.
- Remove direct construction of `EventProofReconciliationService`, `MongoTimelineRepository`, and `RealDateProvider` inside `TaskManager.failTask()`.
- Forward payload `submittedTxHash` into reconciliation failure marking.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/scheduler/__tests__/TaskManager.test.ts backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts`
- Expected: PASS.

### Task 5: Full verification

**Files:**
- No code changes expected.

**Step 1: Run focused regression bundle**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineApiService.test.ts backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/scheduler/__tests__/TaskManager.test.ts backend/src/scheduler/__tests__/ReconcileEventProof.test.ts`
- Expected: PASS.

**Step 2: Run full suite**
- Run: `bun test:all`
- Expected: `0 fail`.

**Step 3: Run build**
- Run: `bun run build`
- Expected: successful build.
