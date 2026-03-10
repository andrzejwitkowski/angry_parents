# Event Proof Blockchain Design

**Context**

Timeline events are editable, so blockchain proof cannot be derived from the current mutable event payload. A proof must always represent an immutable snapshot of a specific event version. Forensic documents keep a separate proof flow and algorithm, so this design isolates event proofing from the existing forensic anchoring path.

**Goals**

- Anchor timeline event versions to Polygon via Viem.
- Keep full proof history for all event edits.
- Return proof data from the timeline item read model.
- Use mock anchoring in local/unit environments and real Polygon clients in `test` and `production`.

**Architecture**

- Add an event-proof model to `TimelineItem` that stores immutable proof snapshots per version.
- Add a blockchain facade/service dedicated to event proof publishing.
- Keep `MockBlockchainAnchor` for development/unit flows.
- Use `ViemBlockchainAnchor` for Polygon Amoy in `NODE_ENV=test` and Polygon Mainnet in `NODE_ENV=production`.
- Persist proof history directly with the timeline item so `GET /api/events/:id/proof` can read from the event aggregate without touching forensic document storage.

**Data Model**

Each timeline item will gain versioned proof history, conceptually:

- `version`: integer version of the event snapshot.
- `proofPayloadHash`: canonical hash of the immutable snapshot for that version.
- `txHash`: blockchain transaction hash.
- `blockNumber`: block number returned by receipt.
- `anchoredAt`: ISO timestamp when anchoring completed.
- optional metadata for status/error if needed.

Updates create a new snapshot version. Existing proof entries are never overwritten. The latest event remains editable, but each proof entry still points to the exact version that was anchored.

**Hashing Strategy**

The service will derive a canonical snapshot from the event version, not from the current mutable entity shape at read time. The hash input should be stable and deterministic, including fields that define the event version while excluding volatile transport details. This prevents later edits from invalidating older proofs.

**Blockchain Layer**

A new or updated blockchain port will expose publish semantics that return both transaction hash and block number:

- `publishHash(hash: string): Promise<{ txHash: string; blockNumber: bigint }>`

`ViemBlockchainAnchor` will:

- validate `BLOCKCHAIN_PRIVATE_KEY` starts with `0x` and contains valid hex,
- use `BLOCKCHAIN_RPC_URL`,
- select `polygonAmoy` for `NODE_ENV=test`, `polygon` for `NODE_ENV=production`,
- send a zero-value transaction carrying the hash in calldata,
- call `waitForTransactionReceipt` before returning,
- log readable backend errors for insufficient funds, RPC issues, or receipt failures.

`MockBlockchainAnchor` will return deterministic `txHash` and `blockNumber` for unit/dev flows.

**Environment Selection**

Recommended runtime selection:

- `development` or unit tests: mock anchor
- `test`: real Viem anchor on Polygon Amoy
- `production`: real Viem anchor on Polygon Mainnet

To preserve existing test stability, unit tests that run under `NODE_ENV=test` should explicitly opt into the mock through a dedicated override such as `USE_MOCK_BLOCKCHAIN=true`, while integration tests for the facade can disable that override and verify Viem wiring.

**API**

Primary endpoint required by the task:

- `GET /api/events/:id/proof`

Response:

```json
{ "txHash": "0x...", "blockNumber": "12345", "hash": "..." }
```

This returns the latest anchored proof for the timeline item. If the event does not exist, return `404`. If the event exists but has no anchored proof yet, return `404` with a clear `proof not available` style message.

Because full history is required by the business rule, the internal model will store all versions and proofs now. The public API can be extended later with either `GET /api/events/:id/proof-history` or `GET /api/events/:id/proof?version=n` without reworking persistence.

**Testing**

- Unit tests: verify event proof service passes the computed hash to the blockchain handler and stores proof history on the timeline item using the mock anchor.
- Integration tests: verify blockchain facade chooses Viem in `NODE_ENV=test`, uses `BLOCKCHAIN_RPC_URL`, validates the private key, and configures the Amoy chain.
- E2E smoke tests: verify `GET /api/events/:id/proof` returns `200` for existing anchored events and `404` for missing events.

**Configuration**

Update `.env.example` with:

- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- optional `USE_MOCK_BLOCKCHAIN`

No private keys are hardcoded anywhere.

**Migration / Compatibility**

Existing forensic blockchain classes and scheduler flows can remain for forensic proofing. Event proofing should be introduced as a separate path so future forensic-proof algorithm changes do not affect timeline event proof history.
