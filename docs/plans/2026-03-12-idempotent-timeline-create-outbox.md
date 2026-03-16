# Idempotent Timeline Create Outbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `POST /api/timeline` idempotent and durably enqueue downstream work so retries remain safe after HTTP, Mongo, or scheduler failures.

**Architecture:** Add a request idempotency record keyed by client-provided `idempotencyKey` and a durable outbox for downstream task intents. Persist the timeline item, forensic intent, idempotency record, and outbox entries in the same transaction, then have a dispatcher flush outbox entries into `TaskManager` until acknowledged.

**Tech Stack:** Bun, TypeScript, MongoDB/Mongoose, Elysia, TaskManager, Vitest/Bun test

---

### Task 1: Add failing tests for idempotent timeline create replay

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Modify: `backend/src/adapters/rest/events/__tests__/TimelineController.test.ts`

**Step 1: Write the failing service test**

Add a test that calls `createItem(...)` twice with the same `idempotencyKey` and expects the same persisted item id instead of two different items.

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts`
Expected: FAIL because `idempotencyKey` is ignored and duplicate items are created.

**Step 3: Write the failing controller test**

Add a controller test proving `POST /api/timeline` requires and forwards `idempotencyKey`.

**Step 4: Run test to verify it fails**

Run: `bun test backend/src/adapters/rest/events/__tests__/TimelineController.test.ts`
Expected: FAIL because route schema/body handling has no `idempotencyKey`.

### Task 2: Add idempotency request persistence

**Files:**
- Create: `backend/src/domain/events/ports/TimelineMutationRequestRepository.ts`
- Create: `backend/src/adapters/mongo/models/TimelineMutationRequestModel.ts`
- Create: `backend/src/adapters/mongo/repositories/events/MongoTimelineMutationRequestRepository.ts`
- Modify: `backend/src/config/wireDependencies.ts`
- Test: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`

**Step 1: Write the failing repository tests**

Cover:
- save request record by `idempotencyKey`
- find existing request by `idempotencyKey`
- unique dedupe semantics for same logical request

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
Expected: FAIL because repository/model do not exist.

**Step 3: Implement minimal model and repository**

Persist:
- `idempotencyKey`
- `operation` (`CREATE_TIMELINE_ITEM`)
- `status`
- `timelineItemId`
- optional canonical request fingerprint/error metadata

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
Expected: PASS.

### Task 3: Add durable outbox persistence

**Files:**
- Create: `backend/src/domain/shared/ports/TaskOutboxRepository.ts`
- Create: `backend/src/adapters/mongo/models/TaskOutboxModel.ts`
- Create: `backend/src/adapters/mongo/repositories/shared/MongoTaskOutboxRepository.ts`
- Test: `backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts`

**Step 1: Write the failing outbox tests**

Cover:
- append pending outbox entries
- claim pending outbox entries once
- mark outbox entry dispatched
- recover stale claimed entry

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts`
Expected: FAIL because model/repository do not exist.

**Step 3: Implement minimal outbox model and repository**

Each outbox record should include:
- `type`
- `payload`
- `payloadHash`
- `status`
- `availableAt`
- claim/lock metadata

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts`
Expected: PASS.

### Task 4: Move timeline create to transactional idempotency + outbox

**Files:**
- Modify: `backend/src/domain/events/service/TimelineService.ts`
- Modify: `backend/src/domain/events/service/TimelineApiService.ts`
- Modify: `backend/src/adapters/rest/events/TimelineController.ts`
- Modify: `backend/src/config/wireDependencies.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Test: `backend/src/adapters/rest/events/__tests__/TimelineController.test.ts`

**Step 1: Extend DTO flow with `idempotencyKey`**

Pass `idempotencyKey` from controller to API service to domain service.

**Step 2: Implement transactional create path**

Inside one transaction:
- check existing request record by `idempotencyKey`
- if completed, return existing item
- if absent, create item + forensic intent + request record + outbox rows for `PROCESS_FORENSIC_INTENT` and `PUBLISH_EVENT_PROOF`

**Step 3: Remove direct scheduler calls from request path**

Do not call `taskManager.schedule(...)` directly from `createItem()` after commit.

**Step 4: Run tests**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/adapters/rest/events/__tests__/TimelineController.test.ts`
Expected: PASS.

### Task 5: Add outbox dispatcher

**Files:**
- Create: `backend/src/domain/shared/service/TaskOutboxDispatcher.ts`
- Modify: `backend/src/config/createApp.ts`
- Modify: `backend/src/config/wireDependencies.ts`
- Test: `backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts`

**Step 1: Write the failing dispatcher test**

Cover:
- claim pending outbox entries
- schedule into `TaskManager`
- mark entry dispatched on success
- leave entry pending/recoverable on scheduler failure

**Step 2: Run test to verify it fails**

Run: `bun test backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts`
Expected: FAIL because dispatcher does not exist.

**Step 3: Implement minimal dispatcher**

Add a simple startup/background dispatcher used by app boot and test endpoints.

**Step 4: Run test to verify it passes**

Run: `bun test backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts`
Expected: PASS.

### Task 6: Add failure-injection and integration tests for durable create

**Files:**
- Modify: `backend/src/config/createApp.ts`
- Create/Modify: `tests/e2e-backend/timeline_create_idempotency.test.ts`
- Test: `backend/src/config/__tests__/createApp.dev-seed.test.ts`

**Step 1: Write the failing integration/E2E tests**

Cover:
- duplicate POST with same `idempotencyKey` returns same item
- simulated scheduler outage after commit does not lose work
- replay after lost response does not create second item

**Step 2: Run test to verify it fails**

Run: `E2E_TEST=true bun test tests/e2e-backend/timeline_create_idempotency.test.ts`
Expected: FAIL because create path is not idempotent and enqueueing is not durable.

**Step 3: Add minimal test hooks if necessary**

Only add test endpoints/hooks required to simulate dispatcher flush or scheduler outage.

**Step 4: Run integration tests to verify pass**

Run: `E2E_TEST=true bun test tests/e2e-backend/timeline_create_idempotency.test.ts`
Expected: PASS.

### Task 7: Verify full focused suite

**Files:**
- Verify only

**Step 1: Run focused suite**

Run: `E2E_TEST=true bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/adapters/rest/events/__tests__/TimelineController.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts backend/src/adapters/mongo/repositories/shared/__tests__/MongoTaskOutboxRepository.test.ts backend/src/domain/shared/service/__tests__/TaskOutboxDispatcher.test.ts tests/e2e-backend/timeline_create_idempotency.test.ts`

Expected: PASS.

**Step 2: Commit**

```bash
git add backend src tests docs/plans/2026-03-12-idempotent-timeline-create-outbox.md
git commit -m "feat: make timeline create idempotent and durably enqueued"
```
