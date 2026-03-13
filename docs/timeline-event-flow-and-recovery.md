# Timeline Event Flow and Recovery

This document explains how a timeline event moves through the system today: from browser-side encryption, to API submission, to durable scheduling, to blockchain proof anchoring, and finally to proof reads and recovery.

It also explains the current idempotency model and the failure-recovery paths added in the proof-hardening work.

## Scope

This document covers:
- timeline item `create`, `update`, and `delete`
- client-side encryption and decryption
- mutation signatures and integrity metadata
- server-side persistence and versioning
- forensic-intent and event-proof scheduling
- durable outbox dispatch
- blockchain submission and reconciliation
- idempotency behavior
- failure recovery

This document does not cover:
- WebAuthn registration internals in full detail
- passkey provisioning internals beyond what is needed for timeline signing/encryption
- general auth/session behavior outside the E2EE-sensitive parts

## Terms

- `encryptedPayload`: per-parent ciphertext map sent by the browser
- `ciphertext`: the single ciphertext selected by the backend for the currently authenticated parent
- `versionHistory`: immutable snapshots of each timeline version
- `proofHistory`: lifecycle records for blockchain anchoring of a specific version snapshot
- `forensic intent`: durable record used by the forensic pipeline for signature/integrity processing
- `task outbox`: durable queue of tasks that must be dispatched to the scheduler
- `mutation request`: idempotency record for create requests keyed by `idempotencyKey`

## High-Level Flow

```text
Browser plaintext form
  -> client encrypts sensitive fields for each parent
  -> client signs mutation metadata
  -> API request with encrypted payload + signature metadata + idempotencyKey
  -> backend validates auth, family ownership, and encrypted-only contract
  -> timeline item persisted with version snapshot
  -> forensic intent persisted
  -> durable outbox entries appended
  -> outbox dispatcher creates scheduler tasks
  -> proof publication submits version hash on-chain
  -> reconciliation confirms receipt later if needed
  -> GET /api/events/:id/proof returns the latest version's proof state only
```

## 1. Browser-Side Encryption

Timeline content is encrypted in the browser before it leaves the device.

Current implementation:
- `src/lib/api/timeline.ts`
- `encryptTimelineItem()` calls `authApi.getMe()` to fetch `family.parentPublicKeys`
- one plaintext JSON blob is built from the sensitive fields of the item
- that blob is encrypted separately for each parent public key
- the request sends `encryptedPayload[parentId] = ciphertext`

Important rules:
- the backend does not encrypt timeline content
- the backend must receive `encryption: "ENCRYPTED"`
- sensitive fields are not stored as top-level plaintext fields in the backend write path
- metadata needed for routing and domain validation remains plaintext, for example:
  - `type`
  - `date`
  - `childId`
  - `createdBy`
  - audit/version metadata

### Create Encryption Flow

```text
User edits form in plaintext
  -> frontend removes protected/system fields from DTO
  -> frontend JSON-serializes content fields
  -> frontend encrypts same plaintext for each parent public key
  -> frontend sends encryptedPayload plus plaintext metadata
```

### Update Encryption Flow

```text
User loads event
  -> frontend decrypts current user's ciphertext locally
  -> user edits plaintext in browser
  -> frontend rebuilds content blob
  -> frontend re-encrypts for all parents
  -> frontend PATCHes encrypted payload only
```

### Delete Flow

Delete does not send decrypted content. It sends only signed mutation metadata proving who requested the delete and when.

## 2. Client-Side Decryption

Timeline reads are returned with only the current user's `ciphertext` selected by the backend.

Current implementation:
- `src/lib/api/timeline.ts`
- `decryptTimelineItems()` loads the active timeline private key from the E2EE session cache
- if `ciphertext` exists, the client decrypts it locally and merges decrypted fields back into the UI model

If decryption fails:
- the item remains encrypted in the UI model
- the client logs a warning and does not invent fallback plaintext

## 3. Mutation Signature and Integrity Metadata

Create, update, and delete operations carry:
- `signatureBase64`
- `timestamp`
- `keyId`

Create also requires:
- `idempotencyKey`

Purpose of these fields:
- bind the mutation to a signer and signing key
- support forensic-intent processing
- provide replay protection and traceability
- allow durable idempotent create semantics

## 4. API Contract and Authorization

Current backend entry point:
- `backend/src/adapters/rest/events/TimelineController.ts`

The controller enforces:
- authenticated session
- typed route/body contract
- `encryption: "ENCRYPTED"` for create/update
- required signature metadata
- required `idempotencyKey` for create

`TimelineApiService` adds:
- parent-role authorization
- child ownership / family ownership checks
- latest-version proof read semantics for `GET /api/events/:id/proof`

## 5. Server-Side Create Flow

Current main orchestration:
- `backend/src/domain/events/service/TimelineService.ts`

### Create Sequence

```text
POST /api/timeline
  -> TimelineController
  -> TimelineApiService.createItem()
  -> TimelineService.createItem()
     -> validate idempotencyKey presence when idempotency repo is enabled
     -> compute requestHash from payload
     -> look up existing mutation request
     -> reject same idempotencyKey with different payload hash
     -> replay existing item if request already completed
     -> validate signature metadata and child existence
     -> build initial audit entry
     -> choose deterministic timeline item ID when idempotency is active
     -> validate encrypted-only domain contract
     -> bootstrap versionHistory with version 1 snapshot
     -> resolve signer public key
     -> claim mutation request as IN_PROGRESS
     -> save timeline item
     -> save forensic intent
     -> append outbox tasks
     -> update mutation request to COMPLETED
     -> optionally direct-schedule proof only when outbox is disabled
```

### Why deterministic item IDs matter

For idempotent creates, the service chooses the timeline item ID before persistence.

That allows safe replay and recovery when:
- Mongo transactions are unavailable
- a duplicate-key race happens on the mutation record
- the first attempt partially claimed the request but failed before the full write completed

## 6. Update and Delete Flow

Update and delete follow the same core pattern:
- validate authorization and signature metadata
- build the next immutable event version
- append an audit entry
- create a forensic intent
- persist the timeline mutation
- append durable outbox work for forensic processing and event-proof publication

Important current behavior:
- when durable outbox is enabled, update/delete do not also directly schedule proof publication
- this avoids dual scheduling paths for the same proof work

### Versioning model

Each mutation creates a new version snapshot in `versionHistory`.

That means event proof anchoring is not for the mutable item as a whole. It is for a specific version snapshot.

```text
version 1 -> original created snapshot
version 2 -> updated snapshot or soft-deleted snapshot
version 3 -> later mutation snapshot
```

Proof reads now always refer to the latest version only.

## 7. Forensic Intent and Durable Outbox

`TimelineService.saveWithForensicIntent()` persists three categories of state together:
- the timeline mutation
- the forensic intent record
- outbox entries for async follow-up work

Current async tasks appended to the outbox:
- `PROCESS_FORENSIC_INTENT`
- `PUBLISH_EVENT_PROOF`

The outbox entry now stores:
- `taskType`
- `payload`
- `payloadHash`
- `retryPolicy`
- dispatch/claim status fields

This matters because durable scheduling should preserve the same retry strength as direct scheduling.

## 8. Outbox Dispatch to Scheduler

Current dispatcher:
- `backend/src/domain/shared/service/TaskOutboxDispatcher.ts`

Flow:

```text
task outbox entry claimed
  -> dispatcher calls taskManager.schedule(taskType, payload, { retryPolicy })
  -> if scheduler accepts task, outbox entry marked DISPATCHED
  -> if scheduler fails, outbox entry returns to PENDING
```

This protects against transient scheduler outages because work remains durable in storage until dispatch succeeds.

## 9. Event Proof Anchoring Flow

Current main orchestration:
- `backend/src/domain/events/service/TimelineEventProofService.ts`

### What gets anchored

The anchored hash is derived from the exact version snapshot, not from the mutable live item.

```text
timeline version snapshot
  -> calculateEventProofHash(snapshot)
  -> hash submitted on-chain
  -> resulting tx/receipt attached back to that version's proofHistory
```

### Proof lifecycle

Current proof lifecycle states:
- `CLAIMED`
- `RECONCILING`
- `SUBMITTED`
- `CONFIRMED`
- `FAILED`

Typical flow:

```text
no proof yet
  -> append CLAIMED
  -> atomically transition to RECONCILING
  -> submit hash on-chain
  -> persist SUBMITTED with submittedTxHash
  -> schedule reconciliation
  -> if immediate receipt available, persist CONFIRMED
  -> otherwise later reconciliation confirms it
```

### Why `RECONCILING` exists

`RECONCILING` marks that one worker has claimed responsibility for the in-flight transition and prevents repeated concurrent submission attempts from all workers.

## 10. Proof Read Semantics

Current read endpoint:
- `GET /api/events/:id/proof`

Current rule:
- only the latest version's `proofHistory` is considered
- if the latest version has no proof record, the API returns `proof not found`
- the API does not fall back to a previous version's confirmed proof

This is important because an older confirmed proof does not prove that the current mutated version is anchored.

## 11. Idempotency

This section describes the create idempotency model in detail.

### Request key

The browser sends `idempotencyKey` as a top-level create field.

Current frontend behavior:
- `src/lib/api/timeline.ts`
- if the caller does not provide one, the client generates one with `crypto.randomUUID()`
- the key is not placed inside the encrypted payload

### Request hash

The backend computes a deterministic `requestHash` from the create payload fields that define the logical mutation.

If the same `idempotencyKey` is reused with a different `requestHash`:
- the request is rejected
- the system treats that as illegal key reuse, not a replay

### Mutation request states

Current lifecycle:
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED` (reserved for failure-state modeling)

Current safe path:

```text
first create request
  -> save mutation request as IN_PROGRESS with deterministic timelineItemId
  -> persist timeline item
  -> persist forensic/outbox work
  -> update mutation request to COMPLETED
```

### Replay behavior

If the same request is retried later with the same key and same payload:
- the backend finds the mutation request
- if the referenced timeline item exists, it returns the existing item
- no duplicate timeline item is created

### Why this is safe on standalone Mongo

Transactions may be unavailable on standalone or degraded Mongo environments.

The current design avoids poisoning the key by:
- claiming `IN_PROGRESS` first, not `COMPLETED`
- persisting a deterministic `timelineItemId`
- allowing the mutation request to advance to `COMPLETED` only after the item save succeeds
- replaying the already-created item on duplicate-key races

That means a failed first attempt can still be retried safely without creating orphan duplicates or permanently blocking the key.

## 12. Failure Recovery

This section explains the main failure scenarios and the current recovery behavior.

### A. Browser or network failure after request sent

Symptoms:
- client times out
- browser loses connection
- caller is unsure whether create succeeded

Recovery:
- caller retries with the same `idempotencyKey`
- backend returns the existing item if the original write already completed

### B. Scheduler outage during async task dispatch

Symptoms:
- timeline write succeeds but scheduler is offline

Recovery:
- work remains in durable outbox as `PENDING`
- dispatcher retries later
- retry policy is preserved from outbox into scheduler scheduling

### C. Duplicate-key race on mutation request

Symptoms:
- two equivalent creates arrive nearly simultaneously

Recovery:
- one request wins the idempotency record
- the loser re-reads the mutation request and returns the already-created item if hashes match

### D. Timeline item save fails after idempotency claim

Symptoms:
- request was claimed as `IN_PROGRESS`
- timeline persistence fails before item exists

Recovery:
- key is not marked `COMPLETED`
- later retry reuses the deterministic item ID and can finish the write cleanly

### E. Blockchain submission succeeds but proof persistence fails

Symptoms:
- `submitHash()` returns a tx hash
- repository write for `SUBMITTED` proof fails

Recovery:
- reconciliation is still scheduled with out-of-band `submittedTxHash`
- reconciliation now persists that tx hash back onto the proof record even when receipt is not yet available
- later retries can continue recovery without resubmitting on-chain

### F. Receipt not available yet

Symptoms:
- tx submitted, receipt missing or delayed

Recovery:
- proof remains `SUBMITTED` or `RECONCILING`
- reconciliation task throws deliberately so scheduler retry policy applies
- later reconciliation checks the receipt again

### G. Reconciliation retries exhausted

Symptoms:
- repeated receipt checks never confirm the tx

Recovery:
- scheduler now calls an injected failure handler for `RECONCILE_EVENT_PROOF`
- that handler marks the proof as `FAILED`
- out-of-band `submittedTxHash` is preserved when available

This design keeps domain-specific failure logic out of the generic scheduler core.

### H. Manual proof recovery

Current endpoint:
- `POST /api/events/:id/proof/publish`

Behavior:
- re-enters proof publication with `retryPending: true`
- if there is already a `SUBMITTED` proof with a known tx hash, it schedules reconciliation instead of resubmitting immediately
- if there is a `RECONCILING` proof with a known tx hash, it also re-schedules reconciliation

## 13. Sequence Flows

### Create with durable outbox

```text
Browser
  -> encrypt content for each parent
  -> add signature metadata
  -> add idempotencyKey
  -> POST /api/timeline

API
  -> auth + role + child ownership checks
  -> TimelineService.createItem()

TimelineService
  -> hash request
  -> claim idempotency record as IN_PROGRESS
  -> persist timeline item version 1
  -> persist forensic intent
  -> append outbox tasks
  -> mark mutation request COMPLETED

OutboxDispatcher
  -> dispatch PROCESS_FORENSIC_INTENT
  -> dispatch PUBLISH_EVENT_PROOF

TimelineEventProofService
  -> hash exact version snapshot
  -> submit on-chain
  -> persist proof state
  -> reconcile until confirmed
```

### Update/delete proof flow

```text
Browser decrypts locally
  -> user edits locally or chooses delete
  -> browser re-signs mutation
  -> browser re-encrypts updated content if needed
  -> PATCH/DELETE request
  -> backend creates next immutable version snapshot
  -> backend appends forensic + proof outbox tasks
  -> proof for that exact version is published asynchronously
```

### Recovery after persistence failure post-submit

```text
submitHash() succeeds
  -> tx hash exists
  -> markProofSubmitted() fails
  -> schedule reconciliation with submittedTxHash in task payload
  -> reconciliation receives payload tx hash
  -> reconciliation persists tx hash back onto proof record
  -> later receipt lookup confirms proof without duplicate submission
```

## 14. Current Guarantees

- timeline content encryption happens client-side only
- backend rejects plaintext timeline writes in the hardened path
- create requests are idempotent when the same key is retried with the same payload
- latest-version proof reads do not lie by falling back to older confirmed versions
- update/delete async work uses durable outbox when configured
- outbox-dispatched tasks preserve retry policy
- reconciliation can recover from persistence failure after chain submission when a tx hash is known

## 15. Current Non-Goals / Limits

- this does not guarantee immediate blockchain confirmation during the request itself
- durable outbox guarantees dispatch persistence, not instant scheduler availability
- `FAILED` proof state still requires operator/user-triggered recovery if the environment never produces a receipt
- this document describes the current implementation, not a formal protocol spec
