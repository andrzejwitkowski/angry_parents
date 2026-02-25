#!/usr/bin/env bash
# Run this script to create all MVP GitHub issues
# Prerequisites: gh auth login && gh repo set-default
# Usage: bash scripts/create-gh-issues.sh

set -e

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Creating issues for: $REPO"

# ─── BLOCKERS ───────────────────────────────────────────────────────────────

gh issue create \
  --title "[BLOCKER] Persist all repositories to MongoDB" \
  --label "blocker,backend,database" \
  --body "## Problem
All domain repositories are currently \`InMemory\` — all data (custody, children, passkeys, schedules) is lost on server restart.

## Tasks
- [ ] Create \`MongoChildRepository\` implementing \`IChildRepository\`
- [ ] Create \`MongoCustodyRepository\` implementing \`ICustodyRepository\`
- [ ] Create \`MongoScheduleRepository\` implementing \`IScheduleRepository\`
- [ ] Create \`MongoPasskeyRepository\` implementing \`IPasskeyRepository\`
- [ ] Add Mongoose schemas for each domain model
- [ ] Wire all Mongo repos in \`backend/src/index.ts\` (replace InMemory)
- [ ] Unit tests for each new Mongo repo (happy + edge cases)

## Definition of Done
All tests pass. Server restart does not lose data."

gh issue create \
  --title "[BLOCKER] Calendar Events — encrypted CRUD with forensic audit" \
  --label "blocker,feature,encryption,blockchain" \
  --body "## Problem
There is no model, API, or UI for adding arbitrary events (medical, school, custody notes) to the calendar. This is the core MVP feature.

## Tasks
- [ ] Define \`CalendarEvent\` domain model: \`{ id, childId, title, start, end, type, notes, createdBy, updatedAt }\`
- [ ] Create \`ICalendarEventRepository\` port
- [ ] Create \`MongoCalendarEventRepository\` — store only **ciphertext** in MongoDB
- [ ] Create \`CalendarEventService\`:
  - \`addEvent(event, momPublicKey, dadPublicKey)\` — RSA-OAEP encrypt for both parties
  - \`updateEvent(id, patch)\` — triggers new forensic doc + blockchain anchor
  - \`deleteEvent(id)\` — soft-delete with audit trail
  - \`getEventsForRange(childId, from, to)\`
- [ ] Create \`CalendarEventController\` (Elysia): \`GET/POST /api/events\`, \`PATCH/DELETE /api/events/:id\`
- [ ] Unit tests for service (encrypt/decrypt, wrong key rejection)
- [ ] Cypress E2E: 'User can add and view a calendar event'

## Acceptance Criteria
Events saved to MongoDB are unreadable without the RSA private key. Polygon TX hash recorded for every mutation."

gh issue create \
  --title "[BLOCKER] YubiKey RSA-OAEP public key registration" \
  --label "blocker,security,auth,feature" \
  --body "## Problem
Current \`BunCryptoService\` only handles ECDSA (WebAuthn). Calendar event encryption requires RSA-OAEP keys from YubiKey PIV slots.

## Tasks
- [ ] Add \`yubikeyRsaPublicKey\` (PEM SPKI) field to User/Passkey model
- [ ] \`POST /api/users/public-key\` — store RSA public key per user
- [ ] \`GET /api/users/public-key/:userId\` — retrieve
- [ ] Create \`RsaOaepCryptoService\` adapter:
  - \`encryptForBothParties(data, momPubKey, dadPubKey): Promise<{ momCipher, dadCipher }>\`
  - \`decrypt(ciphertext, privateKey): Promise<string>\` (runs in browser, key never leaves client)
- [ ] Frontend \`useEncryption\` hook using \`crypto.subtle\`
- [ ] Settings UI: 'Register YubiKey RSA Public Key' (paste PEM or import from YubiKey PIV)
- [ ] Status indicators: 'Mom's key: ✅' / 'Dad's key: ⚠️ not registered'
- [ ] Unit tests: round-trip encrypt/decrypt, wrong key rejection

## Notes
Private key **never** leaves the client. Encryption happens in the browser via Web Crypto API."

gh issue create \
  --title "[BLOCKER] Switch blockchain anchor from Mock to Polygon (viem)" \
  --label "blocker,blockchain,backend" \
  --body "## Problem
\`MockBlockchainAnchor\` is active in production code path. \`ViemBlockchainAnchor\` (Polygon) is commented out.

## Tasks
- [ ] Activate \`ViemBlockchainAnchor\` when \`NODE_ENV=production\`; keep Mock for test
- [ ] Wire calendar event mutations into the ForensicService pipeline
- [ ] Fund server wallet with MATIC (Polygon mainnet) or test MATIC (Amoy testnet)
- [ ] Expose \`GET /api/events/:id/proof\` returning \`{ txHash, blockNumber, hash }\`
- [ ] Unit tests: blockchain publish handler receives correct hash

## Env Vars Required
\`\`\`
BLOCKCHAIN_PRIVATE_KEY=0x...
\`\`\`"

gh issue create \
  --title "[BLOCKER] Persist overlapping custody — MongoDB + validation" \
  --label "blocker,backend,custody" \
  --body "## Problem
Custody rules and schedule data are lost on restart. Overlap detection exists in \`ConflictService\` but is untested for edge cases.

## Tasks
- [ ] Verify \`ConflictService\` handles all overlap edge cases with unit tests
- [ ] \`POST /api/rules/overlap-check\` endpoint — check before saving
- [ ] Frontend: call overlap-check in \`CustodyWizard\`, show conflict warning dialog
- [ ] Cypress E2E: 'Adding overlapping custody shows conflict warning'

## Acceptance Criteria
Overlapping custodies are stored with both sets of dates visible. UI warns user before confirming."

# ─── PRODUCTION HARDENING ────────────────────────────────────────────────────

gh issue create \
  --title "[HARDENING] Production auth config — better-auth + MongoDB + RBAC" \
  --label "security,auth,backend" \
  --body "## Tasks
- [ ] Wire \`better-auth\` MongoDB adapter with \`MONGODB_URI\`
- [ ] Remove / guard all \`/api/test/*\` endpoints (trigger-sync, process-tasks, DELETE /api/test/database) — return 403 in production
- [ ] RBAC: tag \`mom\` / \`dad\` roles on user creation; restrict event mutation to authenticated party only
- [ ] Session expiry + refresh token config
- [ ] HTTPS-only cookie flags: \`Secure\`, \`HttpOnly\`, \`SameSite=Strict\`"

gh issue create \
  --title "[HARDENING] Environment variables & secrets management" \
  --label "security,devops" \
  --body "## Tasks
- [ ] Create \`.env.example\` documenting all required vars
- [ ] Required production vars:
  \`\`\`
  MONGODB_URI
  BLOCKCHAIN_PRIVATE_KEY
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  NODE_ENV=production
  PORT=3000
  CORS_ORIGIN=https://yourdomain.com
  \`\`\`
- [ ] Update CORS in \`index.ts\` to use \`process.env.CORS_ORIGIN\`
- [ ] Verify \`.env\` is in \`.gitignore\`"

gh issue create \
  --title "[HARDENING] Production build pipeline" \
  --label "devops,ci" \
  --body "## Tasks
- [ ] Confirm \`npm run build\` (tsc + vite) produces clean \`dist/\`
- [ ] Create \`backend/build.sh\`:
  \`\`\`bash
  bun build backend/src/index.ts --target=bun --outdir=backend/dist --minify
  \`\`\`
- [ ] Verify \`bun run backend/dist/index.js\` starts correctly against real MongoDB
- [ ] All unit tests pass: \`bun test --exclude tests/e2e-backend\`"

# ─── INFRASTRUCTURE ───────────────────────────────────────────────────────────

gh issue create \
  --title "[INFRA] Baremetal server setup (Bun + Docker + MongoDB)" \
  --label "devops,infrastructure" \
  --body "## Tasks
- [ ] Install Bun: \`curl -fsSL https://bun.sh/install | bash\`
- [ ] Install Docker + Docker Compose
- [ ] Create non-root deploy user: \`adduser deploy\`
- [ ] Clone repo to \`/opt/angry-parent-pat\`
- [ ] Copy \`.env.production\` → \`/opt/angry-parent-pat/.env\`
- [ ] Add MongoDB auth to \`docker-compose.yml\` (\`MONGO_INITDB_ROOT_USERNAME/PASSWORD\`)
- [ ] Create \`docker-compose.prod.yml\` with restart policy + resource limits
- [ ] Set up daily MongoDB backup cron (\`mongodump\` → remote storage)"

gh issue create \
  --title "[INFRA] Systemd service for Bun backend" \
  --label "devops,infrastructure" \
  --body "## Tasks
- [ ] Create \`/etc/systemd/system/angry-parent-backend.service\`:
  \`\`\`ini
  [Unit]
  Description=Angry Parent Pat Backend
  After=network.target docker.service

  [Service]
  Type=simple
  User=deploy
  WorkingDirectory=/opt/angry-parent-pat
  EnvironmentFile=/opt/angry-parent-pat/.env
  ExecStart=/home/deploy/.bun/bin/bun run backend/src/index.ts
  Restart=always
  RestartSec=5

  [Install]
  WantedBy=multi-user.target
  \`\`\`
- [ ] \`systemctl enable angry-parent-backend && systemctl start\`
- [ ] Verify \`GET /api/health\` returns \`{ status: 'ok' }\`"

gh issue create \
  --title "[INFRA] Nginx reverse proxy + TLS (Let's Encrypt)" \
  --label "devops,infrastructure,security" \
  --body "## Tasks
- [ ] Install Nginx: \`apt install nginx\`
- [ ] Configure \`/etc/nginx/sites-available/angry-parent-pat\`:
  - HTTP → HTTPS redirect
  - Serve React SPA from \`dist/\` with SPA fallback (\`try_files \$uri /index.html\`)
  - Proxy \`/api/*\` and \`/forensic/*\` to \`http://127.0.0.1:3000\`
- [ ] Install certbot: \`apt install certbot python3-certbot-nginx\`
- [ ] Obtain cert: \`certbot --nginx -d yourdomain.com -d www.yourdomain.com\`
- [ ] Verify auto-renew: \`certbot renew --dry-run\`

## ⚠️ Critical
WebAuthn / YubiKey passkeys **require HTTPS**. No TLS = no login."

gh issue create \
  --title "[INFRA] DNS configuration for bought domain" \
  --label "devops,infrastructure" \
  --body "## Tasks
- [ ] At domain registrar, set:
  - \`A\` record: \`yourdomain.com → <server IP>\`
  - \`A\` record: \`www → <server IP>\`
  - \`AAAA\` if IPv6 available
- [ ] Set TTL to 300s initially, then 3600s after verified
- [ ] Confirm domain resolves before running certbot"

# ─── CI/CD ────────────────────────────────────────────────────────────────────

gh issue create \
  --title "[CI/CD] GitHub Actions deploy pipeline" \
  --label "ci,devops" \
  --body "## Tasks
- [ ] Create \`.github/workflows/deploy.yml\`:
  1. \`bun test --exclude tests/e2e-backend\` (unit)
  2. \`bun test tests/e2e-backend\` (e2e backend)
  3. \`bun x cypress run\` (e2e UI)
  4. SSH deploy: \`git pull && bun install && npm run build && systemctl restart angry-parent-backend\`
- [ ] Add GitHub secrets: \`SSH_PRIVATE_KEY\`, \`SERVER_HOST\`, \`DEPLOY_USER\`
- [ ] Generate deploy SSH key; add public key to \`~deploy/.ssh/authorized_keys\`
- [ ] Deploy only triggers if **all** tests pass"

# ─── MVP FEATURES ─────────────────────────────────────────────────────────────

gh issue create \
  --title "[FEATURE] Calendar Events UI — encrypted add/edit/delete" \
  --label "feature,frontend,encryption" \
  --body "## Tasks
- [ ] Create \`EventModal.tsx\`: fields for title, date range, type (CUSTODY/MEDICAL/SCHOOL/OTHER), notes
- [ ] Integrate into \`BetterCalendar.tsx\`: click day → open \`EventModal\`
- [ ] On save: encrypt payload client-side with \`RsaOaepCryptoService\`, POST to \`/api/events\`
- [ ] On load: fetch events for visible month range, decrypt in browser, display on calendar days
- [ ] Cypress E2E: 'User can create, view, and delete a calendar event'

## Dependencies
- #[BLOCKER: Calendar Events API]
- #[BLOCKER: YubiKey RSA-OAEP key registration]"

gh issue create \
  --title "[FEATURE] Forensic audit trail UI — Polygon TX hash browser" \
  --label "feature,frontend,blockchain" \
  --body "## Tasks
- [ ] Create \`AuditTrailPage.tsx\` consuming \`GET /forensic/chain\`
- [ ] Display: event hash, Polygon TX hash, timestamp, signing parties
- [ ] Link TX hash to \`https://polygonscan.com/tx/<hash>\`
- [ ] Add sidebar navigation entry

## Dependencies
- #[BLOCKER: Switch to real blockchain anchor]"

echo ""
echo "✅ All issues created for $REPO"
echo "   View at: https://github.com/$REPO/issues"
