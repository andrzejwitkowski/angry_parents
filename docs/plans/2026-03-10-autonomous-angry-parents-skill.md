# Autonomous Angry Parents Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-specific autonomous execution skill and wire it into the existing instruction surfaces used by OpenCode and related agent layers.

**Architecture:** Keep one full canonical skill body in `.opencode/skills/` and one mirrored copy in `.agent/skills/`. Use short references in existing rule files so the repo does not fragment policy across multiple large duplicated documents.

**Tech Stack:** Markdown skill docs, repo instruction files, git worktree workflow

---

## Task 1: Add the canonical skill docs

**Files:**
- Create: `.opencode/skills/autonomous-angry-parents-execution/SKILL.md`
- Create: `.agent/skills/autonomous-angry-parents-execution/SKILL.md`

**Step 1: Write the failing test**

Use the missing-file state as the failing reproduction.

**Step 2: Run test to verify it fails**

Run: `test -f .opencode/skills/autonomous-angry-parents-execution/SKILL.md && test -f .agent/skills/autonomous-angry-parents-execution/SKILL.md`
Expected: fail because the skill files do not exist yet.

**Step 3: Write minimal implementation**

Create the two skill files with the approved repo-specific autonomous execution guidance.

**Step 4: Run test to verify it passes**

Run: `test -f .opencode/skills/autonomous-angry-parents-execution/SKILL.md && test -f .agent/skills/autonomous-angry-parents-execution/SKILL.md`
Expected: success.

**Step 5: Commit**

```bash
git add .opencode/skills/autonomous-angry-parents-execution/SKILL.md .agent/skills/autonomous-angry-parents-execution/SKILL.md
git commit -m "docs: add autonomous repo execution skill"
```

## Task 2: Wire the skill into existing repo rules

**Files:**
- Modify: `.opencode/skills/plan-rules/SKILL.md`
- Modify: `.agent/skills/plan-rules/SKILL.md`
- Modify: `.agents/workflows/plan-rules.md`
- Modify: `.github/copilot-instructions/plan-rules.md`
- Modify: `.agent/rules/react-ts-rules.md`

**Step 1: Write the failing test**

Treat the absence of references to the new autonomous skill as the failing state.

**Step 2: Run test to verify it fails**

Run: `rg -n "autonomous-angry-parents-execution" .opencode/skills/plan-rules/SKILL.md .agent/skills/plan-rules/SKILL.md .agents/workflows/plan-rules.md .github/copilot-instructions/plan-rules.md .agent/rules/react-ts-rules.md`
Expected: no matches.

**Step 3: Write minimal implementation**

Add short references instructing agents to prefer the new skill for implementation/debug/review work in this repo.

**Step 4: Run test to verify it passes**

Run the same `rg -n` command.
Expected: all targeted files include a reference.

**Step 5: Commit**

```bash
git add .opencode/skills/plan-rules/SKILL.md .agent/skills/plan-rules/SKILL.md .agents/workflows/plan-rules.md .github/copilot-instructions/plan-rules.md .agent/rules/react-ts-rules.md
git commit -m "docs: reference autonomous execution skill"
```

## Task 3: Verify final consistency

**Files:**
- Modify: `docs/plans/2026-03-10-autonomous-angry-parents-skill-design.md`
- Modify: `docs/plans/2026-03-10-autonomous-angry-parents-skill.md`

**Step 1: Define the final verification**

Use repo-wide verification of skill placement and references as the final reproduction target.

**Step 2: Run the baseline verification**

Run: `git diff --check`
Expected: clean output if formatting is already correct; otherwise fix issues before completion.

**Step 3: Write minimal implementation**

Fix any formatting or consistency issue if verification finds one.

**Step 4: Run test to verify it passes**

Run:
- `git diff --check`
- `git status --short`

Expected: no diff formatting problems and only intended file changes.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-10-autonomous-angry-parents-skill-design.md docs/plans/2026-03-10-autonomous-angry-parents-skill.md
git commit -m "docs: add autonomous skill design and plan"
```
