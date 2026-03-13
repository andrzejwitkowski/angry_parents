# [ARCH] Bulletproof event proof state machine and infinite recovery model

## Problem
The event proof flow is not yet safe for indefinite retry under Mongo, scheduler, process-crash, and Polygon/RPC failures.

Current failure windows can leave proofs in states that are not fully recoverable or not fully idempotent, especially around:
- `RECONCILING` as a dead-end state
- crash or process death after moving proof to `RECONCILING` but before `submitHash()` starts, leaving no safe automatic resume path
- `submitHash()` succeeds but Mongo fails before `submittedTxHash` is persisted
- finite retry exhaustion in reconciliation without converging proof state to a domain-level recoverable error model

## Goal
Define and implement a proof publication state machine and recovery model that remains safe under repeated retries until infrastructure recovers.

## Required outcome
For every failure boundary in the proof flow, repeated retry must be safe and converge eventually once Mongo, scheduler, or Polygon become available again.

## Scope
- Redesign proof lifecycle state machine so there are no dead states
- Remove or replace persisted transient lock semantics that can strand proofs
- Guarantee recoverability after `submitHash()` success even if Mongo write fails immediately afterward
- Define domain-level handling for retry exhaustion:
  - when proof should remain retryable forever
  - when proof should enter explicit `FAILED` with `lastError`
  - how manual or automatic resume works from `FAILED`
- Add repair/recovery sweepers or equivalent periodic reconciliation for stranded proof records
- Make `SUBMITTED` plus `submittedTxHash` safely retryable indefinitely
- Add failure-injection coverage for:
  - crash after claim, before submit
  - submit success plus Mongo persist failure
  - scheduler/task timeout mid-flight
  - repeated Polygon receipt lookup failures
  - retry exhaustion and later recovery after infra returns

## Acceptance criteria
- No proof lifecycle state is unrecoverable without unsafe manual mutation
- Re-running proof publication/reconciliation after task failure is safe indefinitely
- Proof state and task state cannot diverge permanently without a repair path
- Tests demonstrate recovery after Mongo outage, scheduler outage, process crash, and Polygon/RPC outage

## Related
- #35 Polygon hardening
- #36 [INFRA] Bulletproof timeline event creation idempotency and durable enqueueing
