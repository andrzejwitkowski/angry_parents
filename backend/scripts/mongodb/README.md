# MongoDB Scripts

This directory is reserved for future MongoDB operational scripts related to timeline event proof history.

Current status:
- no production migration is required yet
- no backfill script is needed yet
- new event proof fields are written only for fresh runtime data created after the feature rollout

If production rollout later requires data work, place scripts here using clear names such as:
- `backfill-timeline-event-proof-versions.ts`
- `verify-timeline-event-proof-versions.ts`
- `repair-timeline-event-proof-records.ts`

Keep scripts idempotent where possible and document execution steps in `docs/mongodb/`.
