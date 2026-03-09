# E2EE Review Round 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the second round of PR review feedback around E2EE unlock, logout, and initial session hydration.

**Architecture:** Keep SecurityContext as the single source of truth for lock and unlock state. Remove duplicated UI-side unlock and cleanup behavior, then harden initial auth hydration so stale async responses cannot repopulate session state incorrectly.

**Tech Stack:** React, TypeScript, Bun test, React Testing Library, GitHub PR review

---

### Task 1: SessionExpiredDialog unlock regression

**Files:**
- Modify: `src/components/security/SessionExpiredDialog.test.tsx`
- Modify: `src/components/security/SessionExpiredDialog.tsx`

**Step 1: Write the failing test**
- Add a test proving successful unlock relies on `refreshE2eeSessionState()` and does not manually call `unlockSession()`.

**Step 2: Run test to verify it fails**
- Run: `bun test src/components/security/SessionExpiredDialog.test.tsx`

**Step 3: Write minimal implementation**
- Remove the redundant post-refresh `hasStoredPrivateKey()` and `unlockSession()` path.

**Step 4: Run test to verify it passes**
- Run: `bun test src/components/security/SessionExpiredDialog.test.tsx`

### Task 2: SidebarFooter logout cleanup regression

**Files:**
- Modify: `src/components/sidebar/SidebarFooter.test.tsx`
- Modify: `src/components/sidebar/SidebarFooter.tsx`

**Step 1: Write the failing test**
- Add a test proving `handleLogout()` does not call `clearActivePrivateKey()` after `lockForLogout()`.

**Step 2: Run test to verify it fails**
- Run: `bun test src/components/sidebar/SidebarFooter.test.tsx`

**Step 3: Write minimal implementation**
- Remove the duplicate key scrub and keep logout cleanup routed through `lockForLogout()`.

**Step 4: Run test to verify it passes**
- Run: `bun test src/components/sidebar/SidebarFooter.test.tsx`

### Task 3: SecurityContext initial hydration hardening

**Files:**
- Modify: `src/context/SecurityContext.test.tsx`
- Modify: `src/context/SecurityContext.tsx`

**Step 1: Write the failing test**
- Add a test that stale initial `authApi.getMe()` hydration cannot overwrite cleared local session state.

**Step 2: Run test to verify it fails**
- Run: `bun test src/context/SecurityContext.test.tsx`

**Step 3: Write minimal implementation**
- Guard the initial hydration effect against stale completion and keep failure state consistent.

**Step 4: Run test to verify it passes**
- Run: `bun test src/context/SecurityContext.test.tsx`

### Task 4: Final verification and review replies

**Files:**
- Modify: `src/components/security/SessionExpiredDialog.test.tsx`
- Modify: `src/components/sidebar/SidebarFooter.test.tsx`
- Modify: `src/context/SecurityContext.test.tsx`

**Step 1: Run focused verification**
- Run: `bun test src/components/security/SessionExpiredDialog.test.tsx src/components/sidebar/SidebarFooter.test.tsx src/context/SecurityContext.test.tsx`

**Step 2: Run full verification**
- Run: `bun test:all`

**Step 3: Reply in review threads**
- Use `gh api repos/andrzejwitkowski/angry_parents/pulls/27/comments/<id>/replies` with short fix notes.
