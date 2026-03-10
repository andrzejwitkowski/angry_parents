---
name: React and TS Project Rules
description: Core rules for development including environment, testing strategy, observability, security, CI/CD, and Definition of Done.
---

0. Plan first and always wait for my acceptance
You have to plan for every request I made and show me the detailed planning list and wait for acceptance
0.1 Use mgrep instead of grep
1. Environment & Stack
Runtime: Bun (Always). Use Bun-native APIs for file system, hashing, and server logic.

Package Manager: bun exclusively.

Frontend: React + Vite + Tailwind CSS + shadcn/ui.

Backend: Bun + MongoDB Atlas (Mongoose).

i18n: react-i18next. Zero hardcoded strings in UI.

2. Testing Strategy (Strict)
Unit Tests (bun:test): - Every business logic function/helper must have a .test.ts.

Happy Path: At least one test for expected input.

Edge Cases: Mandatory testing of boundary conditions (nulls, empty strings, max/min values, invalid roles).

Integration/E2E Tests (Cypress):

Rule: Exactly one integration test file per feature/functionality.

Focus on user flow: "User can log in", "User can submit sensitive form".

Command: bun x cypress open.

Visual Regression (Playwright/Cypress-Image-Diff):

Screenshot tests for every UI component in Light and Dark mode.

3. Structured Logging & Observability
Format: Single-line JSON for ELK/Kibana.

Fields: timestamp, level, msg, context (userId, traceId).

Constraint: No raw console.log. Use a structured logger helper.

4. Security & Encryption
Auth: RBAC (Role-Based Access Control) with USER and ADMIN.

Encryption: Sensitive data (e.g., PII) must be encrypted asynchronously using RSA-OAEP (Web Crypto API) before saving to MongoDB.

Hashing: Bun.password.hash() for credentials.

5. UI & Look and Feel
Components: shadcn/ui. Check @/components/ui before adding.

Command: bun x shadcn-ui@latest add [component].

Styling: Tailwind CSS only.

Split components into smallest logically sensible parts and built from the bottom to up and REUSE

6. CI/CD (GitHub Actions)
Pipeline: 1. bun test (Units) 2. cypress run (Integrations) 3. playwright test (Visuals)

Deploy to Vercel/Oracle only if ALL tests pass.

7. Architecture Principles
Simplicity: Favor flat folder structures and "Prostota nad abstrakcję".

Backend structure convention (this repo): use `domain/<context>/{model,ports,service}`; keep HTTP in `adapters/rest/*`; keep persistence in `adapters/mongo/*`; keep crypto/blockchain/logging in dedicated adapter folders.

8. Definition of done
For every new feature unit tests and e2e cypress tests MUST be created. All projects tests must pass 

Parsability: Code must be easy for AI to read and for Kibana to index.

9. After any feature implementation ALWAYS perform a browser manual test and fix any bugs that you found during the process
10. Always run all tests after feature is done - fix any errors in tests or in logic
11. When new feature or a bug is fixed ALWAYS analyze if a new unit / integration test should be created and propose one
12. After all changes are made you ALWAYS must execute 'bun test:all' - and all tests must pass - if not analyze and fix - you are not allowed to write that the feature/bug fix is done until all tests pass

13. Commits, hooks and versioning rules
Commit messages MUST follow conventional commits accepted by this repo: `feat`, `fix`, `bugfix`, `docs`, `chore`, `refactor`, `test`, `ci`.

Use `!` only for real breaking changes. Any allowed type with `!` (for example `refactor(core)!:`) MUST be treated as a major release signal.

Use `BREAKING CHANGE:` only in the commit body/footer and only when the change is truly breaking.

Feature, fix, docs, chore, refactor, test and ci branches outside `main` MUST keep `package.json` on a `-SNAPSHOT` version.

`main` MUST always use a final version without `-SNAPSHOT`.

Release automation MUST calculate the next version from the latest released git tag, not from a stale branch `package.json` version.

Release automation MUST create annotated tags and push them explicitly with the release commit.

Release workflows on `main` MUST use GitHub Actions concurrency guards to avoid racing release commits or tags.

Pre-push hooks and prechecks MUST validate the actual destination refs being pushed from hook stdin, not only `git branch --show-current`, because pushes like `HEAD:main` and multi-ref pushes must be checked correctly.
