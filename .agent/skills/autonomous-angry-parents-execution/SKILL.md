---
name: autonomous-angry-parents-execution
description: Use when implementing, debugging, reviewing, or finishing work in this repo while minimizing user questions and staying aligned with local project rules, architecture, testing discipline, release/versioning policy, and security constraints.
---

# Autonomous Angry Parents Execution

> Note: This file is a mirror of `.opencode/skills/autonomous-angry-parents-execution/SKILL.md` and must be kept in sync with it to avoid divergence.

## Overview

This skill is the default execution governor for `angry_parents`.

Its job is to maximize autonomous progress while preserving repo-specific discipline:
- superpowers-first execution
- repo evidence before user questions
- senior-level maintainable code
- strict testing and regression prevention
- clean architecture boundaries
- no spaghetti code
- no shortcuts around release, security, or verification rules

**Core principle:** Ask the user only when repo evidence, installed skills, MCP tools, and project memory cannot safely resolve the decision.

**Violating the letter of the repo rules is violating the spirit of this skill.**

## Environment Assumptions

This repo runs with superpowers skills available and they MUST be preferred whenever applicable.

Available support tools include:
- `mgrep` for local code search
- `Context7` for documentation lookup
- `github` for PR/issues/actions/review inspection
- `sequential-thinking` for complex reasoning
- `memory` for durable project facts across sessions

**Default execution order:**
1. Load relevant superpowers skill(s)
2. Inspect repo patterns with `mgrep` and local reads
3. Use `memory` to recover prior project decisions
4. Use `Context7` or `github` only when repo evidence is insufficient
5. Use `sequential-thinking` for ambiguous or multi-stage technical reasoning
6. Ask the user only if still blocked by secrets, destructive actions, or true architectural ambiguity

## Audience And Quality Bar

Write for a senior engineer audience.

The human partner:
- is strong in Java and Kotlin
- is comfortable in Rust and TypeScript
- understands architecture and engineering concepts
- does NOT need beginner-oriented explanations

Therefore:
- prefer precision over tutorial tone
- explain decisions briefly, technically, and architecturally
- do not write teaching code for juniors
- do not hide weak architecture behind verbosity
- do not produce spaghetti code
- do not produce clever abstractions that reduce readability

**Target quality:** clean, maintainable, analyzable code with explicit responsibilities and low surprise.

**Not acceptable:**
- monolithic services
- giant React components
- mixed business logic and transport concerns
- hidden coupling
- unclear ownership of state or dependencies
- bug fixes without regression coverage

## When To Use

Use this skill for most non-trivial work in this repo:
- feature work
- bug fixes
- CI/CD failures
- release issues
- review feedback
- refactors
- architecture-sensitive frontend/backend changes

Do NOT use this skill for:
- purely conversational questions
- tasks requiring credentials not present in the environment
- destructive operations requiring explicit user intent
- work where another narrower repo-specific skill fully governs the task and no orchestration is needed

## Mandatory Repo Rules

This skill NEVER overrides repo-specific rules. It must enforce them.

Always obey:
- `React and TS Project Rules`
- `Hexagonal Architecture for React and Bun`
- `Strict E2EE Rules`
- release/versioning conventions already defined in the repo
- superpowers discipline skills such as:
  - `systematic-debugging`
  - `test-driven-development`
  - `verification-before-completion`
  - `receiving-code-review`
  - `finishing-a-development-branch`
  - `using-git-worktrees`
  - `writing-plans`
  - `brainstorming`

If any repo rule and local intuition conflict, the repo rule wins.

When an older local instruction still says "plan first and always wait for my acceptance", this skill narrows that rule for this repo: explicit user acceptance is required only for secrets, destructive actions, production/security/release policy changes, or genuinely unresolved architecture ambiguity after repo inspection.

## Autonomy Rules

### Default posture

- act autonomously by default
- prefer reading the repo over asking the user
- prefer existing patterns over new inventions
- prefer smaller, safer, more maintainable changes over broad rewrites
- prefer consistency with current architecture over local convenience

### Question threshold

Do NOT ask the user if the answer can be determined from:
- existing repo code
- existing tests
- workflow files
- commit history
- installed superpowers skills
- `memory`
- `Context7`
- `github`

Ask the user only when:
- a secret, token, account id, or external credential is required
- the action is destructive or irreversible
- the choice changes security posture, billing, production behavior, or release semantics
- the architecture direction is genuinely ambiguous after repo inspection
- two options are materially different and repo evidence does not resolve the choice

### If a question is unavoidable

- perform all non-blocked work first
- ask exactly one question
- provide the recommended default first
- state what would change depending on the answer

## Mandatory Skill Routing

### Feature work
Use:
- `brainstorming`
- `writing-plans`
- `React and TS Project Rules`
- `Hexagonal Architecture for React and Bun` when backend/domain changes apply
- `Strict E2EE Rules` when timeline/auth/sensitive data changes apply
- `test-driven-development`
- `verification-before-completion`

### Bug fix / failing tests / CI failure / release failure
Use:
- `systematic-debugging`
- `test-driven-development`
- `verification-before-completion`
- `sequential-thinking` when root cause is multi-step or unclear

### Review feedback
Use:
- `receiving-code-review`
- `verification-before-completion`

### Branch completion / PR / merge / release cleanup
Use:
- `finishing-a-development-branch`
- `verification-before-completion`

### Isolated implementation work
Use:
- `using-git-worktrees` when work should not disturb current workspace

## Tool Priority

### 1. Local repo evidence first
Use:
- `mgrep` first for codebase discovery
- file reads for exact context
- git history/status/diff for behavior and conventions

### 2. Memory second
Use `memory` for durable project facts such as:
- user preferences
- known CI/release pitfalls
- architectural decisions
- previously rejected review suggestions
- branch/versioning conventions

### 3. External documentation third
Use:
- `Context7` when framework/library behavior is unclear
- `github` when PRs, issues, actions, or external examples matter

### 4. Structured reasoning when complexity warrants it
Use `sequential-thinking` for:
- difficult debugging
- architecture tradeoffs
- multi-stage release or CI failures
- contradictory evidence

### 5. User questions last
Questions are expensive. Treat them as the final fallback, not the default tool.

## Architecture Defaults For This Repo

### Backend
Prefer:
- domain-first structure
- bounded contexts and subdomains
- explicit ports and adapters
- thin controllers
- orchestration in services/facades
- persistence in repositories/adapters
- infrastructure isolation

Default shape:
- `domain/<context>/{model,ports,service}`
- `adapters/rest/*`
- `adapters/mongo/*`
- technical adapters separated by responsibility

Avoid:
- business logic in controllers
- framework leakage into domain
- repository logic inside services
- cross-context hacks without explicit boundaries
- giant service classes that do everything

### Frontend
Prefer:
- small logical components
- hooks for orchestration/stateful behavior
- UI composition over large all-in-one components
- client API layer isolation
- forms separated from transport and display concerns

Avoid:
- page components with all logic inline
- state, API calls, rendering, and data transformation in one file
- prop spaghetti
- duplicate business logic across components
- mixing encryption/security logic into presentation where an adapter or API layer should hold it

### Clean code bar
Prefer:
- explicit names
- low nesting
- stable boundaries
- obvious data flow
- code that is easy to scan and reason about

Do not overdo abstraction:
- no abstraction for its own sake
- no pattern inflation
- no enterprise ceremony without payoff

## React Structure Rules

For React in this repo:
- split UI into atomic logical components
- separate presentation, local interaction state, remote data access, and domain-specific transformations
- keep pages thin where possible
- keep reusable UI behavior in hooks or lower-level components
- prefer composition over giant top-heavy trees
- keep forms focused and isolated
- avoid smart mega-components

**Litmus test:** if a React file is hard to reason about in one pass, it is probably too large or has mixed responsibilities.

## Regression And Test Policy

Every bug fix MUST include regression protection.

That means:
- update an existing test if the old expectation is now wrong
- or add a new test if the broken behavior had no coverage

A bug fix is NOT complete until:
1. the broken behavior is reproduced or evidenced
2. regression coverage exists
3. the fix passes that coverage
4. relevant surrounding tests still pass

Do not ship:
- manual-only bug fixes
- silent contract changes without test updates
- fixes that only satisfy the current symptom but leave no regression protection

### Minimum test discipline

- business logic changes => unit tests
- bug fixes => regression test or updated existing test
- backend flows => integration coverage when relevant
- user-critical flows => e2e coverage when relevant
- release/CI bugs => executable reproduction or workflow-equivalent verification when possible

## CI And Release Defaults

For CI and release work:
- read logs before changing code
- compare failing workflow against working workflow patterns in the repo
- prefer minimal workflow fixes over speculative code changes
- preserve release/versioning conventions already established in the repo

Always remember:
- feature branches stay `-SNAPSHOT`
- `main` uses final versions
- release versions derive from latest released tag
- release workflows need explicit, deterministic behavior
- prechecks and hooks must validate actual pushed refs, not guessed branch state

## E2EE Defaults

For timeline/auth/sensitive-data work:
- never introduce plaintext server-side encryption fallbacks
- assume sensitive content must be encrypted client-side before leaving the browser
- treat metadata and encrypted payloads as separate concerns
- avoid leaking key material or plaintext through logs or errors
- preserve strict payload contracts

If a change touches timeline/auth/private key/session lock logic and `Strict E2EE Rules` was not loaded, stop and load it.

## Memory Usage

Use `memory` to store durable project knowledge, not noise.

### Good memory examples
- user strongly prefers minimal questions because each interaction is costly
- release workflow uses split test steps instead of `bun run test:all`
- annotated release tags require explicit git identity in workflow
- repo expects strict `-SNAPSHOT` versioning outside `main`

### Bad memory examples
- temporary branch names for one-off tasks
- ephemeral command outputs
- transient CI failures without lasting lessons
- speculative assumptions

Before asking the user, check whether the answer already exists in memory.

## Red Flags

Stop and correct course if you catch any of these:
- asking before inspecting the repo
- asking before checking memory
- asking before loading an applicable superpowers skill
- changing architecture without verifying existing project patterns
- fixing bugs without regression coverage
- claiming success before fresh verification
- allowing spaghetti code because it is faster
- creating giant React components or giant services
- mixing domain, persistence, transport, and UI concerns in one place
- over-abstracting simple code into unreadable indirection
- using external docs before checking the actual repo implementation
- treating user questions as cheap

## Hard Stop Cases

Do not proceed autonomously past these without user confirmation:
- missing credential or secret required for the task
- destructive git action
- force push
- production, security, billing, or release policy change
- unresolved architecture ambiguity after full repo inspection
- conflict between repo rules and proposed change
- action that would remove or rewrite the user’s unrelated local work

## Quick Reference

| Situation | Default behavior |
|---|---|
| Need to understand code | Load applicable skill, then use `mgrep` and read files |
| Need library behavior | Check repo first, then `Context7` |
| Need PR/issues/actions context | Use `github` |
| Complex root cause | Use `systematic-debugging` + `sequential-thinking` |
| Bug fix | Reproduce, add regression coverage, then fix |
| Feature | Plan first, follow repo architecture, use TDD |
| Timeline/auth/security | Load E2EE rules before changing anything |
| Unsure whether to ask | Do not ask until repo, memory, skills, and MCP tools are exhausted |
| Multiple valid options | Choose the simplest repo-consistent maintainable option |

## Final Rule

```text
Repo evidence first.
Superpowers first.
Tests before trust.
Verification before claims.
Questions only when truly unavoidable.
```

If this skill is active, the agent should feel biased toward autonomous execution, but never toward reckless execution.
