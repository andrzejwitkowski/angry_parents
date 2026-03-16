# Event Proof Hardening Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first hardening layer for timeline event blockchain proofs by persisting submission state, tracking explicit proof lifecycle, and reconciling proofs whose chain state and Mongo state temporarily diverge.

**Architecture:** This phase assumes the event-proof flow from the timeline event proof branch exists or is ported first. The hardening keeps the current per-version proof model, but makes publication lifecycle explicit, stores `submittedTxHash` before receipt confirmation, and adds a reconciliation path for proofs that were submitted to Polygon but not fully finalized in Mongo.

**Tech Stack:** Bun, TypeScript, Elysia, Mongo/Mongoose, Viem, Vitest/Bun test

---

### Task 1: Lock the Phase 1 scope before touching code

**Files:**
- Modify: `docs/plans/2026-03-11-event-proof-hardening-phase-1.md`
- Reference: `docs/plans/2026-03-10-event-proof-blockchain-design.md`
- Reference: `docs/plans/2026-03-10-event-proof-blockchain.md`

**Step 1: Confirm the exact Phase 1 deliverables**

Write down that this phase includes only:
- explicit lifecycle states,
- immediate `submittedTxHash` persistence,
- reconciliation for `SUBMITTED` or stale pending proofs,
- no append-only version ledger,
- no hash chain,
- no client signatures.

**Step 2: Save the scope in the plan and issue thread**

Run: `gh issue view 35 --comments`
Expected: issue includes a Phase 1 tracking comment and the plan remains aligned with that scope.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-11-event-proof-hardening-phase-1.md
git commit -m "docs: capture event proof hardening phase 1 plan"
```

### Task 2: Add failing tests for explicit proof lifecycle state

**Files:**
- Modify: `backend/src/domain/events/model/TimelineItem.ts`
- Modify: `backend/src/domain/events/service/TimelineEventProofService.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineAudit.test.ts`

**Step 1: Write the failing tests**

Add tests that expect proof records to carry an explicit lifecycle state such as `CLAIMED`, `SUBMITTED`, `CONFIRMED`, `FAILED`, and `RECONCILING`.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: FAIL because the current proof record shape does not expose lifecycle state.

**Step 3: Write the minimal implementation**

Extend the event proof record model so lifecycle is explicit instead of inferred only from optional fields.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: PASS for the new lifecycle assertions.

**Step 5: Commit**

```bash
git add backend/src/domain/events/model/TimelineItem.ts backend/src/domain/events/service/TimelineEventProofService.ts backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/domain/events/service/__tests__/TimelineAudit.test.ts
git commit -m "feat: add explicit lifecycle state for event proofs"
```

### Task 3: Add failing tests for immediate submitted transaction persistence

**Files:**
- Modify: `backend/src/domain/events/service/TimelineEventProofService.ts`
- Modify: `backend/src/domain/events/ports/TimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Test: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`

**Step 1: Write the failing tests**

Add tests for the sequence:
- proof is claimed,
- blockchain returns `txHash`,
- service stores `submittedTxHash` and `SUBMITTED` before receipt wait finishes,
- no confirmed fields are written yet.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: FAIL because there is no repository method for persisting the submitted transaction separately.

**Step 3: Write the minimal implementation**

Add a repository transition for `markProofSubmitted(...)` or equivalent and call it immediately after the chain returns a transaction hash.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`
Expected: PASS for submitted-state persistence.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/TimelineEventProofService.ts backend/src/domain/events/ports/TimelineRepository.ts backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts
git commit -m "feat: persist submitted transaction metadata for event proofs"
```

### Task 4: Add failing tests for confirmation and safe lifecycle transitions

**Files:**
- Modify: `backend/src/domain/events/service/TimelineEventProofService.ts`
- Modify: `backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts`
- Modify: `backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
- Test: `backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts`

**Step 1: Write the failing tests**

Add tests that require:
- `SUBMITTED -> CONFIRMED` when receipt arrives,
- merge-safe writes that never drop `submittedTxHash`, `txHash`, `blockNumber`, or `anchoredAt`,
- idempotent re-entry when a confirmed proof already exists.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: FAIL because the current flow finalizes in one step and does not model safe multi-step transitions.

**Step 3: Write the minimal implementation**

Split publication flow into explicit submitted and confirmed updates, while preserving existing idempotency behavior.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts`
Expected: PASS for submitted-to-confirmed transitions.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/TimelineEventProofService.ts backend/src/adapters/mongo/repositories/events/MongoTimelineRepository.ts backend/src/adapters/mongo/inmemory/events/InMemoryTimelineRepository.ts backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts
git commit -m "feat: split event proof submission and confirmation"
```

### Task 5: Add failing tests for Polygon reconciliation of submitted proofs

**Files:**
- Create: `backend/src/domain/events/service/EventProofReconciliationService.ts`
- Modify: `backend/src/domain/shared/ports/IEventBlockchainAnchor.ts`
- Modify: `backend/src/domain/events/ports/TimelineRepository.ts`
- Test: `backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts`
- Test: `backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`

**Step 1: Write the failing tests**

Add tests that require a reconciliation service to:
- load proofs in `SUBMITTED` or stale `CLAIMED` state,
- query Polygon by stored transaction hash,
- finalize a proof when the receipt is present,
- keep or mark the record when the receipt is still missing.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
Expected: FAIL because no reconciliation service or receipt lookup port exists yet.

**Step 3: Write the minimal implementation**

Add a chain receipt lookup port and implement a focused reconciliation service for outstanding proofs.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts`
Expected: PASS for receipt-based reconciliation behavior.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/EventProofReconciliationService.ts backend/src/domain/shared/ports/IEventBlockchainAnchor.ts backend/src/domain/events/ports/TimelineRepository.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/adapters/blockchain/__tests__/ViemBlockchainAnchor.test.ts
git commit -m "feat: reconcile submitted event proofs against polygon receipts"
```

### Task 6: Add failing tests for scheduler wiring of reconciliation work

**Files:**
- Create: `backend/src/scheduler/handlers/ReconcileEventProof.ts`
- Modify: `backend/src/config/registerSchedulerHandlers.ts`
- Modify: `backend/src/scheduler/types.ts`
- Modify: `backend/src/domain/shared/ports/TaskScheduler.ts`
- Test: `backend/src/config/__tests__/registerSchedulerHandlers.test.ts`
- Test: `backend/src/scheduler/__tests__/ReconcileEventProof.test.ts`

**Step 1: Write the failing tests**

Add tests that expect a dedicated reconciliation task type and handler to be registered and callable with proof identifiers or an item/version selector.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/scheduler/__tests__/ReconcileEventProof.test.ts`
Expected: FAIL because reconciliation is not yet represented in scheduler wiring.

**Step 3: Write the minimal implementation**

Add a new task type and handler that delegates to the reconciliation service.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/scheduler/__tests__/ReconcileEventProof.test.ts`
Expected: PASS for registration and handler execution.

**Step 5: Commit**

```bash
git add backend/src/scheduler/handlers/ReconcileEventProof.ts backend/src/config/registerSchedulerHandlers.ts backend/src/scheduler/types.ts backend/src/domain/shared/ports/TaskScheduler.ts backend/src/config/__tests__/registerSchedulerHandlers.test.ts backend/src/scheduler/__tests__/ReconcileEventProof.test.ts
git commit -m "feat: schedule reconciliation for submitted event proofs"
```

### Task 7: Add failing tests for proof status read model and recovery visibility

**Files:**
- Modify: `backend/src/domain/events/service/TimelineApiService.ts`
- Modify: `backend/src/adapters/rest/events/TimelineController.ts`
- Modify: `src/lib/api/timeline.ts`
- Modify: `src/types/timeline.types.ts`
- Test: `backend/src/adapters/rest/events/__tests__/TimelineProofController.test.ts`
- Test: `backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`

**Step 1: Write the failing tests**

Add tests that expect the proof read model to expose enough status for operators and support to distinguish:
- no proof yet,
- proof claimed,
- proof submitted,
- proof confirmed,
- proof failed or reconciling.

**Step 2: Run the focused tests to verify failure**

Run: `bun test backend/src/adapters/rest/events/__tests__/TimelineProofController.test.ts backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`
Expected: FAIL because the current read model returns only anchored proof data.

**Step 3: Write the minimal implementation**

Extend the read model without weakening existing access control or leaking unrelated family data.

**Step 4: Run the focused tests to verify pass**

Run: `bun test backend/src/adapters/rest/events/__tests__/TimelineProofController.test.ts backend/src/domain/events/service/__tests__/TimelineApiService.test.ts`
Expected: PASS for status-oriented proof responses.

**Step 5: Commit**

```bash
git add backend/src/domain/events/service/TimelineApiService.ts backend/src/adapters/rest/events/TimelineController.ts src/lib/api/timeline.ts src/types/timeline.types.ts backend/src/adapters/rest/events/__tests__/TimelineProofController.test.ts backend/src/domain/events/service/__tests__/TimelineApiService.test.ts
git commit -m "feat: expose event proof status for recovery flows"
```

### Task 8: Add integration and smoke coverage for partial failure recovery

**Files:**
- Modify: `tests/e2e-backend/event_proof_smoke.test.ts`
- Modify: `backend/src/config/__tests__/createApp.dev-seed.test.ts`
- Modify: `scripts/dev-all.test.ts`

**Step 1: Write the failing tests**

Add scenarios for:
- tx hash stored but receipt delayed,
- receipt found later by reconciliation,
- proof transitions from `SUBMITTED` to `CONFIRMED` without duplicate chain publication.

**Step 2: Run the focused tests to verify failure**

Run: `bun test tests/e2e-backend/event_proof_smoke.test.ts backend/src/config/__tests__/createApp.dev-seed.test.ts`
Expected: FAIL because the current app does not expose reconciliation-aware behavior.

**Step 3: Write the minimal implementation**

Add only the minimum test setup needed to simulate delayed receipt recovery.

**Step 4: Run the focused tests to verify pass**

Run: `bun test tests/e2e-backend/event_proof_smoke.test.ts backend/src/config/__tests__/createApp.dev-seed.test.ts`
Expected: PASS for recovery flow coverage.

**Step 5: Commit**

```bash
git add tests/e2e-backend/event_proof_smoke.test.ts backend/src/config/__tests__/createApp.dev-seed.test.ts scripts/dev-all.test.ts
git commit -m "test: cover delayed receipt recovery for event proofs"
```

### Task 9: Run full verification and prepare the branch for review

**Files:**
- Modify: `docs/plans/2026-03-11-event-proof-hardening-phase-1.md`

**Step 1: Run focused proof tests**

Run: `bun test backend/src/domain/events/service/__tests__/TimelineEventProofService.test.ts backend/src/domain/events/service/__tests__/EventProofReconciliationService.test.ts backend/src/adapters/mongo/repositories/events/__tests__/MongoTimelineRepository.test.ts backend/src/adapters/rest/events/__tests__/TimelineProofController.test.ts`
Expected: PASS.

**Step 2: Run full project verification**

Run: `bun test:all`
Expected: PASS.

**Step 3: Run the build**

Run: `bun run build`
Expected: PASS.

**Step 4: Update issue #35 with completion status for Phase 1**

Run: `gh issue comment 35 --body "Phase 1 complete: explicit lifecycle state, submitted tx persistence, and proof reconciliation are in place. Next milestone is Phase 2 append-only timeline versions plus hash chaining."`
Expected: a new progress comment is added.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-11-event-proof-hardening-phase-1.md
git commit -m "docs: mark phase 1 verification complete"
```
