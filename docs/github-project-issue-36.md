# [INFRA] Bulletproof timeline event creation idempotency and durable enqueueing

## Problem
Creating a timeline event is not bulletproof under infrastructure failures. If Mongo partially fails, scheduler enqueueing fails after commit, or the client retries after an HTTP timeout / lost response, the system can create duplicate events or leave orphaned side effects.

## Why this matters
The create flow is not idempotent once the request is in flight:
- no request idempotency key or client-stable event identifier
- server always generates a new event id per accepted request
- forensic scheduling is on the synchronous success path, so post-commit enqueue failure can surface as an API error even though the event already exists
- Mongo non-transaction fallback can leave partial persistence (event saved, forensic intent missing)

## Required outcome
Make timeline event creation safe to retry indefinitely, including when:
- client loses the HTTP response after commit
- Mongo is temporarily unavailable
- scheduler is temporarily unavailable
- process crashes between persistence and enqueue

## Scope
- Add idempotent create semantics for `POST /api/timeline`
- Introduce request idempotency key or client-generated stable event id
- Dedupe exact replay/retry on backend
- Remove partial success windows between event persistence and async pipeline enqueueing
- Use a durable outbox or equivalent recovery mechanism
- Eliminate unsafe non-transaction fallback behavior or replace it with an explicit recovery-safe pattern
- Ensure forensic scheduling failure cannot make the client believe create failed after the event was already committed
- Add failure-injection tests for HTTP timeout/lost response, Mongo failure after event save, scheduler unavailable after commit, and replay of the same logical create request

## Acceptance criteria
- Replaying the same logical create request does not create duplicate timeline items
- A committed event is eventually enqueued for downstream work even if scheduler is temporarily down at request time
- No create path can return failure after commit without a recovery-safe way to discover the already-created event
- Tests prove idempotency across Mongo and HTTP failure windows

## Related
- #35 Polygon hardening
- #34 Harden timeline proof persistence against concurrent Mongo updates
