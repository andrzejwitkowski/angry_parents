# Manual Testing: Full Two-Parent Registration Flow

Step-by-step guide to manually verify the complete registration flow for both parents using `curl`.

---

## Prerequisites

Start the database and backend:

```bash
# Terminal 1 – Start the database
bash scripts/start-db.sh

# Terminal 2 – Start the backend
bun run dev:backend
```

You should see `🚀 Server running at 0.0.0.0:3000`.

> **Tip**: Clean up cookie files between test runs with `rm /tmp/cookies_*.txt`.

---

## Step 1 — Register Parent A

```bash
curl -s -c /tmp/cookies_a.txt -b /tmp/cookies_a.txt \
  -X POST http://localhost:3000/api/auth/mock-register-a \
  -H "Content-Type: application/json" \
  -d '{"email":"dad@test.com","name":"Test Dad","gender":"dad"}' \
  | jq
```

✅ **Expected**
```json
{ "verified": true, "role": "parent_a" }
```
A `Set-Cookie: token=...` header should be present.

---

## Step 2 — Verify Parent A's profile

```bash
curl -s -b /tmp/cookies_a.txt \
  http://localhost:3000/api/auth/me \
  | jq
```

✅ **Expected**: `user.gender` is `"dad"` and `user.familyId` is a non-empty string.  
📋 **Save `familyId`** — you will compare it with Parent B's in Step 6.

---

## Step 3 — Parent A invites Parent B

```bash
curl -s -c /tmp/cookies_a.txt -b /tmp/cookies_a.txt \
  -X POST http://localhost:3000/api/auth/invite \
  -H "Content-Type: application/json" \
  -d '{"email":"mom@test.com"}' \
  | jq
```

✅ **Expected**
```json
{ "token": "<uuid>", "link": "http://localhost:5173/register?token=<uuid>" }
```
📋 **Copy the `token` value** — you need it in Steps 4 and 5.

---

## Step 4 — Parent B tries wrong gender (should fail)

Replace `<TOKEN>` with the token from Step 3:

```bash
curl -s \
  -X POST http://localhost:3000/api/auth/mock-register-b \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","gender":"dad"}' \
  | jq
```

✅ **Expected** (`400`)
```json
{ "message": "Drugi rodzic musi być mamą" }
```

---

## Step 5 — Parent B registers with correct gender

```bash
curl -s -c /tmp/cookies_b.txt -b /tmp/cookies_b.txt \
  -X POST http://localhost:3000/api/auth/mock-register-b \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","gender":"mom"}' \
  | jq
```

✅ **Expected** (`200`)
```json
{ "verified": true, "role": "parent_b" }
```
A `Set-Cookie: token=...` header should be present.

---

## Step 6 — Verify Parent B's profile and shared family

```bash
curl -s -b /tmp/cookies_b.txt \
  http://localhost:3000/api/auth/me \
  | jq
```

✅ **Expected**: `user.gender` is `"mom"` and `user.familyId` **exactly matches** the value from Step 2.

---

## Step 7 — Parent A logs out

```bash
curl -s -c /tmp/cookies_a.txt -b /tmp/cookies_a.txt \
  -X POST http://localhost:3000/api/auth/logout \
  | jq
```

✅ **Expected**
```json
{ "ok": true }
```

---

## Step 8 — Verify sessions are independent

Parent A's session is now invalid:

```bash
curl -s -b /tmp/cookies_a.txt \
  http://localhost:3000/api/auth/me \
  | jq
# Expected: 401 Unauthorized
```

Parent B's session is still active:

```bash
curl -s -b /tmp/cookies_b.txt \
  http://localhost:3000/api/auth/me \
  | jq
# Expected: 200 with full user profile and familyId
```

---

## Notes

| Scenario | Expected outcome |
|---|---|
| Parent A registers | `verified: true`, `role: parent_a`, cookie set |
| Parent A invites Parent B | token + link returned |
| Parent B uses same gender | `400` with Polish error message |
| Parent B uses opposite gender | `verified: true`, `role: parent_b`, cookie set |
| Both parents' `familyId` | Identical — same family unit |
| Parent A logs out | Cookie invalidated (`Max-Age=0`) |
| Parent B after Parent A logout | Session unaffected, `200 /me` still works |

> **Different port?** If running via `npm run test` (port 3002), replace `localhost:3000` with `127.0.0.1:3002` in every command above.
