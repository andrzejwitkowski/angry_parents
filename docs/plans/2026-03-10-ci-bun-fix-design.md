# CI Bun Fix Design

Goal: make GitHub Actions deterministic by aligning the repository lockfile with CI and pinning Bun to a fixed version.

Design:
- Replace `bun-version: latest` with one explicit Bun version in all GitHub workflows.
- Refresh `bun.lockb` locally using that same Bun version so `bun install --frozen-lockfile` stops mutating the lockfile in CI.
- Verify locally that frozen install succeeds before committing.

Success criteria:
- `bun install --frozen-lockfile` passes locally with the pinned Bun version.
- The next GitHub Actions run gets past dependency installation.
