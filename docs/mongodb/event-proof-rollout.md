# Event Proof Rollout

## Current decision

No MongoDB migration is required right now.

The timeline event proof history feature is not yet running against existing production data, so we do not need to backfill legacy timeline items at this stage.

## What happens for new data

For newly created or updated timeline events, the application now writes event-proof metadata directly into the timeline item model.

Relevant fields:
- `eventVersion`
- `versionHistory`
- `versionHistory[].proofHistory`

Each editable event version keeps its own immutable snapshot and proof history entry. Proof records contain the event hash and, after successful anchoring, blockchain metadata such as transaction hash, block number, and anchor timestamp.

## Why there is no migration yet

- the feature is not live on production legacy data
- avoiding unnecessary migrations reduces rollout risk
- legacy backfill can be prepared later if old timeline items must become proof-aware

## Future rollout path

If this feature is later introduced for already existing production timeline items, prepare dedicated MongoDB scripts under `backend/scripts/mongodb/`.

Expected future script types:
- backfill version metadata for legacy timeline items
- verify proof-history shape after rollout
- repair inconsistent proof records if needed

## Local verification

To verify the current behavior locally:

1. Create a new timeline event.
2. Update or delete the same event.
3. Check that the stored timeline item contains incremented `eventVersion` and populated `versionHistory` entries.
4. Confirm that anchored versions add records under `versionHistory[].proofHistory`.

## Notes

- This document is organizational only.
- It does not introduce any runtime migration step.
- When a real production rollout needs data migration, document the exact commands and safety checks in this directory.
