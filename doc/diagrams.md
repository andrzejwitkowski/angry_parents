# Application Flow Diagrams

## 1. Authentication & Key Management
> **Note**: The current implementation supports **WebAuthn Registration** (for Yubico/Passkeys). Explicit WebAuthn **Login** endpoint was not found in the custom controller, but the registered keys are used for **Document Signing**.

### WebAuthn Registration (Yubico Key Setup)
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WebAuthnController as "/api/auth/webauthn"
    participant SimpleWebAuthn
    participant DB as PasskeyRepository

    User->>Frontend: Trigger "Register Yubico Key"
    Frontend->>WebAuthnController: GET /register/options
    WebAuthnController->>DB: findByUserId (exclude existing)
    WebAuthnController->>SimpleWebAuthn: generateRegistrationOptions
    WebAuthnController-->>Frontend: challenge, rp info
    Frontend-->>User: Prompt for Key Interaction
    User->>Frontend: Validates Key (Touch)
    Frontend->>WebAuthnController: POST /register/verify (attestation)
    WebAuthnController->>SimpleWebAuthn: verifyRegistrationResponse
    alt Verified
        SimpleWebAuthn-->>WebAuthnController: key info (publicKey, counter)
        WebAuthnController->>DB: save(newPasskey)
        WebAuthnController-->>Frontend: 200 OK
    else Failed
        WebAuthnController-->>Frontend: 400 Error
    end
```

## 2. Document Creation & Signing (Async Flow)
This flow describes how a document is created, signed by users, and then verified asynchronously.

```mermaid
sequenceDiagram
    participant UserA
    participant UserB
    participant ForensicAPI as "/forensic"
    participant API as "/api/auth"
    participant ForensicService
    participant DB as MongoDB
    participant Scheduler as TaskManager
    participant SyncJob as SyncUserPendingDocs

    rect rgb(240, 240, 240)
    Note over UserA, DB: Phase 1: Creation & First Signature
    UserA->>ForensicAPI: POST /pending (Content + SignatureA)
    ForensicAPI->>ForensicService: createPendingDocument
    ForensicService->>DB: getLastFinalizedDocument (Chain Head)
    ForensicService->>ForensicService: Calculate Hash & Link
    ForensicService->>ForensicService: Verify SignatureA (using Key)
    ForensicService->>DB: saveDocument(Status: PENDING)
    end

    rect rgb(240, 255, 240)
    Note over UserB, SyncJob: Phase 2: Second Signature & Trigger
    UserB->>ForensicAPI: POST /pending (Adds SignatureB)
    ForensicAPI->>ForensicService: Update Document
    ForensicService->>DB: saveDocument(Status: PENDING)
    
    UserB->>API: POST /auth/sign-in (Login)
    API->>SyncJob: Trigger "SyncUserPendingDocs"
    SyncJob->>DB: getAllDocuments()
    loop For each PENDING doc
        SyncJob->>SyncJob: Check if signatures >= 2
        opt Steps met
            SyncJob->>Scheduler: Schedule "PROCESS_DOCUMENT_INTEGRITY"
        end
    end
    end
```

## 3. Async Verification & Blockchain Anchoring
This explains the "Async two-step document hashing with blockchain usage" and "Document history verification".

```mermaid
flowchart TD
    subgraph Step1 [Step 1: Integrity Verification]
        Queue1[Task: PROCESS_DOCUMENT_INTEGRITY] --> Handler1(ProcessDocumentIntegrity Handler)
        Handler1 --> FetchDoc[Fetch Document by Index]
        FetchDoc --> CheckHash{Verify Hash?}
        CheckHash -- Mismatch --> Error1[Throw Error / Integrity Fail]
        CheckHash -- Match --> CheckSigs[Verify Signatures]
        
        CheckSigs --> LoopSigs{For each Signature}
        LoopSigs --> FetchKey[Fetch Public Key from PasskeyRepo]
        FetchKey --> VerifySig[Crypto Verify]
        VerifySig -- Invalid --> Error2[Throw Error]
        VerifySig -- Valid --> LoopSigs
        
        LoopSigs -- All Valid --> SchedNext[Schedule BLOCKCHAIN_PUBLISH]
    end

    subgraph Step2 [Step 2: Blockchain Anchoring]
        Queue2[Task: BLOCKCHAIN_PUBLISH] --> Handler2(BlockchainPublish Handler)
        Handler2 --> FetchDoc2[Fetch Document]
        FetchDoc2 --> CheckAnchor{Already Anchored?}
        CheckAnchor -- No --> Anchor[Call BlockchainService.anchorHash]
        Anchor --> SaveTx[Save blockchainTxId]
        CheckAnchor -- Yes --> SkipAnchor[Skip Anchoring]
        
        SaveTx --> Finalize[Set Status = FINALIZED]
        Finalize --> UpdateState[Update SystemState (Head Hash)]
    end

    SchedNext --> Queue2
```

## 4. Document History Verification Mechanism (Chain)

```mermaid
classDiagram
    class ForensicDocument {
        +number index
        +string prevHash
        +object content
        +string hash
        +Signature[] signatures
        +string status
        +string blockchainTxId
    }
    
    class SystemState {
        +number totalDocs
        +string lastFinalHash
    }

    ForensicDocument --> ForensicDocument : prevHash links to previous hash
    SystemState --> ForensicDocument : Tracks Global Head
    
    note for ForensicDocument "Hash = SHA256(Canonical(index, content, prevHash, timestamp))"
```

**Verification Mechanism:**
1. **Chain Linking:** Each document contains `prevHash` which must match the `hash` of the document at `index - 1`.
2. **Content Integrity:** The `hash` of the document is derived from its content, index, `prevHash`, and creation timestamp. Any change invalidates the hash.
3. **Signature Authority:** Signatures are verified against public keys stored in `PasskeyRepository` (Yubico keys).
4. **Blockchain Anchor:** The `hash` is anchored to a blockchain (Step 2), providing an immutable timestamp and proof of existence. `verifyAnchor` can confirm the document hasn't been altered since anchoring.
