---
name: Strict E2EE Rules
description: Strict End-to-End Encryption (E2EE) Rules for Timeline Items
---

# E2EE Strict Assumptions & Rules

This workflow outlines the strict End-to-End Encryption (E2EE) rules that MUST be followed when making changes to the Angry Parent Pat application, specifically regarding sensitive data like Timeline Items. This acts as a set of invariant rules.

## 1. Zero Server-Side Encryption
- **NEVER** implement fallback or primary encryption on the backend.
- The backend is considered untrusted for plaintext sensitive data.
- The `TimelineService.ts` or any other backend service MUST NOT use `encryptRSA` or hold logic to convert plaintext content to ciphertext.

## 2. Client-Side Encryption Is Mandatory
- All encryption **MUST** happen on the client-side (Frontend) before the data leaves the browser.
- The Frontend is responsible for fetching the necessary public keys (e.g., `family.parentPublicKeys`) and encrypting the sensitive fields (like `content`, `diagnosis`, `meds`, etc.).
- Example: `timelineApi.ts` handles the `encryptTimelineItem` logic before dispatching the POST/PATCH request.

## 3. Strict Payload Contract
- The Backend MUST strictly expect and validate that incoming sensitive payloads are already encrypted.
- Data Transfer Objects (DTOs) for creation and updating (e.g., `CreateTimelineItemDto`, `UpdateTimelineItemDto`) MUST require the discriminator `encryption: "ENCRYPTED"`.
- The `encryptedPayload` field MUST be present and correctly formatted as a dictionary of `userId` to `ciphertext`.
- Sending `encryption: "PLAINTEXT"` or attempting to send unencrypted sensitive fields to the backend MUST fail validation (e.g., Zod schemas in `TimelineController.ts` rule this out).

## 4. Metadata vs. Sensitive Data
- **Metadata** (fields necessary for functionality, sorting, or domain rules that do NOT contain PII/sensitive info): e.g., `date`, `type`, `createdBy`, `childId`. These remain unencrypted and are validated by the backend (e.g., "Handover date cannot be in the past").
- **Sensitive Data**: e.g., `content`, `location`, `diagnosis`. These are rolled into the `encryptedPayload` and the backend treats them as an opaque blob. 

## 5. Editing Encrypted Items
- Updates require the client to:
  1. Decrypt the item locally.
  2. Perform edits in plaintext on the client form.
  3. Re-encrypt the item (using the same parent public keys).
  4. Send the updated `ENCRYPTED` payload via PATCH.
- The backend simply replaces the `encryptedPayload` and updates the `auditTrail`. It does not attempt to decrypt or re-encrypt the data during the update process.

## 6. No Key or Content Leaks
- Ensure that backend error messages or logs do NOT leak public keys, user IDs, or any partial plaintext content.

**When working on any feature involving timeline items or sensitive data:**
1. Do not add plaintext fields to the database schema without explicit approval.
2. Ensure any new sensitive fields are stripped from the DTO before sending to the backend, and added to the `extractContentForEncryption` logic on the frontend.
3. Validate all changes using the new E2EE testing structure, ensuring all tests pass with `encryption: "ENCRYPTED"` and a valid `encryptedPayload`.

## 7. Public Keys Must Be Provisioned on Registration
- When a user registers (whether via mock flows or the actual `/register/verify` flow), their `rsaPublicKeyBase64` MUST be generated and added to their family's `parentPublicKeys` array.
- If a user lacks a public key in the family record, other users (and the user themselves) will not be able to encrypt payload for their `userId`.
- This leads to silent failures where their own `ciphertext` is missing from the `encryptedPayload`, causing decryption to fail and the UI to show `Encrypted Entry`.

## 8. Non-Extractable Private Keys
- Once the E2EE private key is decrypted on the client side, it MUST be imported into `window.crypto.subtle` with the `extractable: false` flag before caching in memory or `IndexedDB`.
- This ensures that even if local execution context is compromised (e.g., via XSS), malicious scripts cannot export or exfiltrate the raw private key material.

## 9. Secure Session Lifecycle (Auto-Lock & PRF)
- **Key Eviction:** E2EE private keys MUST be actively cleared from RAM and `IndexedDB` when the user locks their session or when the session timer expires (`clearPrivateKey`).
- **Session Timer:** An automatic session timeout mechanism MUST be active to guard the decrypted key while the user is away.
- **Re-Authentication (Unlock):** Unlocking the session MUST require hardware re-authentication (via WebAuthn `navigator.credentials.get`). This allows the system to utilize the WebAuthn PRF (Pseudo-Random Function) extension to re-derive the master key from the salt and unwrap the encrypted private key locally, without server intervention.
