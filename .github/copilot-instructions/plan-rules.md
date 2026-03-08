---
description: 
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
Auth: RBAC (Role-Based Access Control) with the application's actual role names; keep this document aligned with backend authorization checks (e.g., admin/developer access currently uses role `developer`).

Encryption: Sensitive data (e.g., PII) must use the project's hybrid envelope format: encrypt payload with AES-GCM, wrap the AES key with RSA-OAEP/SHA-256, and store the base64 JSON envelope `{ k, iv, d }`.

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
