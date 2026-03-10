# Autonomous Angry Parents Skill Design

Goal: add a repo-specific execution skill that maximizes autonomous progress while preserving all existing project rules, architecture constraints, testing discipline, and release/security policies.

Design:
- Create a new repo-specific skill in both `.opencode/skills/` and `.agent/skills/`.
- Make the skill prefer superpowers skills, repo evidence, MCP tools, and project memory before asking the user anything.
- Keep lightweight references to the new skill in existing plan/rules instruction files instead of duplicating the full policy everywhere.

Success criteria:
- The new skill exists in both primary skill directories.
- Existing plan/rules files point to the new skill as the default repo execution governor.
- Existing approval-first rule copies are explicitly narrowed so the autonomous skill is not blocked by a blanket acceptance gate.
- The wired rule surfaces state that explicit acceptance is still required for secrets, destructive actions, security/release policy changes, or unresolved architecture ambiguity.
- The new text preserves repo-specific expectations: senior-level maintainable code, no spaghetti, strict regression coverage, architecture clarity, and minimal user questions.
