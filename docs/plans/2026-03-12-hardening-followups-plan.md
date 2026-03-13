# Hardening Follow-Ups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining durability, idempotency, and recovery gaps before commit/push.

**Architecture:** Extend the existing timeline mutation flow so all mutation types commit downstream work through the durable outbox, keep frontend and backend create contracts aligned around a top-level `idempotencyKey`, make create idempotency resilient to duplicate-key races, and make proof publication resumable after on-chain submission succeeds but state persistence partially fails.

**Tech Stack:** Bun, TypeScript, Vitest, Mongoose/Mongo, React.

---

### Task 1: Durable outbox for update/delete timeline mutations

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Modify: `backend/src/domain/events/service/TimelineService.ts`

**Step 1: Write the failing tests**
- Add a test proving `updateItem()` writes both `PROCESS_FORENSIC_INTENT` and `PUBLISH_EVENT_PROOF` outbox rows when `taskOutboxRepository` is enabled.
- Add a test proving `deleteItem()` writes both outbox rows when `taskOutboxRepository` is enabled.

**Step 2: Run tests to verify they fail**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Expected: failures showing update/delete do not enqueue durable outbox work.

**Step 3: Write minimal implementation**
- Pass outbox entries into `saveWithForensicIntent()` from `updateItem()` and `deleteItem()`.
- Preserve existing fallback scheduler behavior when no outbox repository is configured.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Expected: PASS.

### Task 2: Frontend create contract carries top-level idempotencyKey

**Files:**
- Modify: `src/types/timeline.types.ts`
- Modify: `src/lib/api/timeline.ts`
- Create or modify: `src/lib/api/timeline.test.ts`

**Step 1: Write the failing test**
- Add a test proving `timelineApi.create()` sends `idempotencyKey` as a top-level request field and does not place it into encrypted payload content.

**Step 2: Run test to verify it fails**
- Run: `bun test src/lib/api/timeline.test.ts`
- Expected: failure showing request body lacks top-level `idempotencyKey` or incorrectly encrypts it.

**Step 3: Write minimal implementation**
- Add `idempotencyKey` to `CreateTimelineItemInput`.
- Exclude `idempotencyKey` from encrypted content fields in `timelineApi.create()`.
- Include `idempotencyKey` at the top level of the POST body.

**Step 4: Run test to verify it passes**
- Run: `bun test src/lib/api/timeline.test.ts`
- Expected: PASS.

### Task 3: Create idempotency survives duplicate-key races

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Modify: `backend/src/domain/events/service/TimelineService.ts`
- Optionally modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineMutationRequestRepository.ts`

**Step 1: Write the failing test**
- Add a test proving that when mutation-request persistence loses a duplicate-key race for the same `idempotencyKey`, `createItem()` returns the already-created item instead of failing.

**Step 2: Run test to verify it fails**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts`
- Expected: failure showing duplicate-key error escapes.

**Step 3: Write minimal implementation**
- Catch duplicate-key persistence failures in `createItem()`.
- Re-read the mutation request and return the previously committed item when the stored request hash matches.
- Keep mismatched-payload handling strict.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts`
- Expected: PASS.

### Task 4: Resume proof recovery after submit succeeds but persistence fails

**Files:**
- Modify: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Modify: `backend/src/domain/events/service/TimelineEventProofService.ts`

**Step 1: Write the failing test**
- Add a test proving that if `submitHash()` succeeds but proof persistence fails, a later `publishProof(..., { retryPending: true })` can recover by reusing the submitted tx and scheduling reconciliation instead of getting stuck in `RECONCILING` forever.

**Step 2: Run test to verify it fails**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Expected: failure showing the retry path wedges or never schedules recovery.

**Step 3: Write minimal implementation**
- Persist enough fallback state after `submitHash()` success to resume from retry.
- Ensure `retryPending` on a reconciling proof can schedule reconciliation when a submitted tx hash is known.
- Avoid double-submitting the same hash.

**Step 4: Run tests to verify they pass**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Expected: PASS.

### Task 5: Verification

**Files:**
- Verify only

**Step 1: Run focused verification**
- Run: `bun test backend/src/domain/events/service/__tests__/TimelineService.test.ts src/lib/api/timeline.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineMutationRequestRepository.test.ts backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts tests/e2e-backend/timeline_create_idempotency.test.ts tests/e2e-backend/event_proof_smoke.test.ts`

**Step 2: Run full verification**
- Run: `bun test:all`
- Run: `bun run build`

**Step 3: Review final diff**
- Run: `git status --short`
- Run: `git diff --stat`
