---
trigger: always_on
---

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

Parsability: Code must be easy for AI to read and for Kibana to index.