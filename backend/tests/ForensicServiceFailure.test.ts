/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ForensicService } from "../src/application/ForensicService";
import { IForensicRepository } from "../src/core/ports/IForensicRepository";
import { IBlockchainAnchor } from "../src/core/ports/IBlockchainAnchor";
import { ICryptoService } from "../src/core/ports/ICryptoService";
import { ForensicDocument } from "../src/core/domain/forensic/ForensicDocument";

// --- MOCKS ---
const mockRepo = {
    getLastFinalizedDocument: mock(),
    getDocumentByIndex: mock(),
    saveDocument: mock(),
    getSystemState: mock(),
    saveSystemState: mock(),
    getAllDocuments: mock()
} as unknown as IForensicRepository;

const mockBlockchain = {
    anchorHash: mock(),
    verifyAnchor: mock()
} as unknown as IBlockchainAnchor;

const mockCrypto = {
    verifySignature: mock(),
    getFingerprint: mock()
} as unknown as ICryptoService;

const service = new ForensicService(mockRepo, mockBlockchain, mockCrypto);

describe("ForensicService Failure & Retry Proof (Idempotency)", () => {

    beforeEach(() => {
        // Reset call history and implementations
        (mockRepo.getLastFinalizedDocument as any).mockReset();
        (mockRepo.getDocumentByIndex as any).mockReset();
        (mockRepo.saveDocument as any).mockReset();
        (mockRepo.getSystemState as any).mockReset();
        (mockRepo.saveSystemState as any).mockReset();
        (mockRepo.getAllDocuments as any).mockReset();

        (mockBlockchain.anchorHash as any).mockReset();
        (mockBlockchain.verifyAnchor as any).mockReset();

        (mockCrypto.verifySignature as any).mockReset();
        (mockCrypto.getFingerprint as any).mockReset();

        // Default happy path mocks
        (mockCrypto.verifySignature as any).mockResolvedValue(true);
        (mockBlockchain.anchorHash as any).mockResolvedValue("tx_new");
        (mockBlockchain.verifyAnchor as any).mockResolvedValue(true);
        (mockRepo.saveDocument as any).mockResolvedValue(undefined);
        (mockRepo.saveSystemState as any).mockResolvedValue(undefined);
        (mockRepo.getSystemState as any).mockResolvedValue({ totalDocs: 0 });
    });

    // --- CREATE PENDING DOCUMENT ---

    it("Create: Survives crash BEFORE save (DB Empty) -> Retry succeeds", async () => {
        // Setup: DB returns nothing for index 0
        (mockRepo.getLastFinalizedDocument as any).mockResolvedValue(null);
        (mockRepo.getDocumentByIndex as any).mockResolvedValue(null);

        // Action
        const doc = await service.createPendingDocument({}, "pub", "sig", "key", "time", "UserA");

        // Assert
        expect(mockRepo.saveDocument).toHaveBeenCalledTimes(1);
        expect(doc.index).toBe(0);
    });

    it("Create: Survives crash AFTER save (Client Timeout) -> Retry returns existing", async () => {
        // Setup: DB HAS the document now
        const existingDoc = new ForensicDocument(0, {}, "GENESIS_HASH", "time");
        existingDoc.hash = "calculated_hash_placeholder"; // In real app hash is calc'd
        // We simulate the hash check matching. For this test we need to ensure the service calculates the SAME hash.
        // The service logic: calculates hash from inputs. checking if DB doc has same hash.
        // We can't easily force the service to produce a specific hash without mocking ForensicChain, 
        // but we can mock getDocumentByIndex to return a doc that *will match* if we are lucky or check logic.
        // Actually, let's look at the service: it calculates `hash` from input.
        // Then it calls `getDocumentByIndex`.
        // Then checks `existingAtIndex.hash === hash`.

        // Strategy: We let the service calculate the hash first in a dry run, or we mock ForensicChain.calculateHash?
        // Since ForensicChain is static, it's hard to mock in Bun without module mocking.
        // Instead, we trust the deterministic inputs.

        // 1. Run once to populate "DB" (simulated by variable)
        (mockRepo.getLastFinalizedDocument as any).mockResolvedValue(null);
        (mockRepo.getDocumentByIndex as any).mockResolvedValue(null);

        // Capture what the service *would* save
        let savedDoc: ForensicDocument<any> | undefined;
        (mockRepo.saveDocument as any).mockImplementation((d: any) => { savedDoc = d; });

        await service.createPendingDocument({ a: 1 }, "pub", "sig", "key", "time", "UserA");

        // 2. RETRY: Now setup mock to return that SAVED doc
        (mockRepo.getDocumentByIndex as any).mockResolvedValue(savedDoc);

        // Reset save count
        (mockRepo.saveDocument as any).mockClear();

        // Action: Retry
        const retryDoc = await service.createPendingDocument({ a: 1 }, "pub", "sig", "key", "time", "UserA");

        // Assert: Should return existing, NOT save again (except maybe signature update check)
        expect(retryDoc).toBe(savedDoc);
        // It might save if it checks signature, but it shouldn't create new.
        // The logic says: if (!existing.signatures...) save. Here signature is same.
        // So saveDocument might be called 0 times or 1 time (update), but DEFINITELY NOT creating a specific new doc.
        // In our code: "if (!existingAtIndex.signatures.some...) ... save".
        // existingDoc HAS the signature from first run. So 0 saves.
        expect(mockRepo.saveDocument).toHaveBeenCalledTimes(0);
    });

    // --- FINALIZE DOCUMENT ---

    // Scenario 1: Crash AFTER Admin Sig Save, BEFORE Anchor
    it("Finalize: Resume from 'Signed Checkpoint' (Skip Verify/Save Sig, Do Anchor)", async () => {
        const doc = new ForensicDocument(1, {}, "prev", "time");
        doc.hash = "abc";
        // State: Admin ALREADY signed
        doc.signatures.push({ signerId: "Admin", signature: "sigB", timestamp: "t", keyId: "k" });

        (mockRepo.getDocumentByIndex as any).mockResolvedValue(doc);

        await service.finalizeDocument(1, "pub", "sigB", "k", "Admin");

        // Assert
        expect(mockCrypto.verifySignature).not.toHaveBeenCalled(); // Skipped verification
        expect(mockBlockchain.anchorHash).toHaveBeenCalled(); // Proceeded to Anchor
        expect(mockRepo.saveDocument).toHaveBeenCalled(); // Saved result
    });

    // Scenario 2: Crash AFTER Anchor, BEFORE Final Status Save
    it("Finalize: Resume from 'Anchored Checkpoint' (Skip Verify/Save Sig, Skip Anchor)", async () => {
        const doc = new ForensicDocument(1, {}, "prev", "time");
        doc.hash = "abc";
        doc.signatures.push({ signerId: "Admin", signature: "sigB", timestamp: "t", keyId: "k" });
        // State: Already Anchored
        doc.blockchainTxId = "tx_existing_123";

        (mockRepo.getDocumentByIndex as any).mockResolvedValue(doc);

        const res = await service.finalizeDocument(1, "pub", "sigB", "k", "Admin");

        // Assert
        expect(mockCrypto.verifySignature).not.toHaveBeenCalled();
        expect(mockBlockchain.anchorHash).not.toHaveBeenCalled(); // Skipped Anchor!
        expect(res.status).toBe("FINALIZED"); // Ensured finalized
        expect(mockRepo.saveDocument).toHaveBeenCalled(); // To update status to FINALIZED
    });

    // Scenario 3: Zombie Transaction Recovery (Anchor Success, DB Crash, No TxId in DB)
    // User passes existingTxHash to recover.
    it("Finalize: Recover from Zombie Tx (Verify Hash, Save TxId)", async () => {
        const doc = new ForensicDocument(1, {}, "prev", "time");
        doc.hash = "abc";
        // State: Signed, but NO TxId in DB.
        doc.signatures.push({ signerId: "Admin", signature: "sigB", timestamp: "t", keyId: "k" });

        (mockRepo.getDocumentByIndex as any).mockResolvedValue(doc);

        // Action: User provides existingTxHash
        await service.finalizeDocument(1, "pub", "sigB", "k", "Admin", "tx_zombie_recovered");

        // Assert
        expect(mockBlockchain.anchorHash).not.toHaveBeenCalled(); // Should NOT re-anchor
        expect(mockBlockchain.verifyAnchor).toHaveBeenCalledWith("abc", "tx_zombie_recovered"); // Should verify
        expect(doc.blockchainTxId).toBe("tx_zombie_recovered");
        expect(doc.status).toBe("FINALIZED");
    });
});
