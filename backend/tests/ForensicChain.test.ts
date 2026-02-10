/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from "bun:test";
import { verifyIntegrity, ForensicDocument, SystemState } from "../../src/lib/forensic/audit";

describe("Forensic Chain Integrity Audit", () => {
    // Setup: Create a valid chain of 3 documents
    const validDocs: ForensicDocument[] = [];

    const createDoc = async (index: number, content: any, prevHash: string) => {
        const doc: ForensicDocument = {
            index,
            content,
            prevHash,
            timestamp: new Date().toISOString(),
            status: "FINALIZED",
            signatures: [
                { signerId: "UserA", signature: "sigA", timestamp: "", keyId: "1" },
                { signerId: "Admin", signature: "sigB", timestamp: "", keyId: "2" }
            ],
            hash: "",
        };
        // Calculate hash using the same isomorphic method (re-implementing strictly for test setup or exposing helper)
        // For test simplicity, we invoke the internal helper if we could, 
        // but since we can't easily export internal audit helper, we replicate it or trust the audit to calculate it.
        // Wait, verifyIntegrity RE-CALCULATES. So we need to set the 'hash' property to the VALID hash first.

        // Let's rely on verifyIntegrity logic to tell us if we are right.
        // But we need to construct VALID docs first.
        // We will use a helper that matches the audit logic to generate the 'correct' hash.
        return doc;
    };

    // Helper to generate hash compliant with audit.ts
    const generateValidHash = async (doc: any) => {
        // Replicating canonicalize logic from audit.ts for test purpose
        const canonicalize = (obj: any): string => {
            if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
            if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
            const keys = Object.keys(obj).sort();
            const parts = keys.map(k => `"${k}":${canonicalize(obj[k])}`);
            return `{${parts.join(",")}}`;
        };

        const payload = {
            index: doc.index,
            content: doc.content,
            prevHash: doc.prevHash,
            timestamp: doc.timestamp
        };

        const str = canonicalize(payload);
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(str);
        return hasher.digest("hex");
    };

    beforeAll(async () => {
        // Gen Doc 0
        const doc0 = await createDoc(0, { msg: "Genesis" }, "GENESIS_HASH");
        doc0.hash = await generateValidHash(doc0);
        validDocs.push(doc0);

        // Gen Doc 1
        const doc1 = await createDoc(1, { msg: "Update 1" }, doc0.hash);
        doc1.hash = await generateValidHash(doc1);
        validDocs.push(doc1);

        // Gen Doc 2
        const doc2 = await createDoc(2, { msg: "Update 2" }, doc1.hash);
        doc2.hash = await generateValidHash(doc2);
        validDocs.push(doc2);
    });

    it("Passes for a valid chain", async () => {
        const systemState: SystemState = {
            totalDocs: 3,
            lastFinalHash: validDocs[2].hash
        };

        const result = await verifyIntegrity(validDocs, systemState);
        if (!result.valid) console.log("Audit Errors:", result.errors);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("Detects Tampering (SQL/Direct Edit simulation)", async () => {
        // Clone and tamper
        const tamperedDocs = JSON.parse(JSON.stringify(validDocs));
        // Tamper content of reading 1
        tamperedDocs[1].content.msg = "HACKED MSG";
        // Hash remains old!

        const systemState: SystemState = {
            totalDocs: 3,
            lastFinalHash: validDocs[2].hash
        };

        const result = await verifyIntegrity(tamperedDocs, systemState);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes("Hash manipulation"))).toBe(true);
    });

    it("Detects Deletion (Rollback/Gap)", async () => {
        // Simulate deleting the last record
        const deletedDocs = validDocs.slice(0, 2); // Only 0 and 1

        // System state says 3, but we only found 2
        const systemState: SystemState = {
            totalDocs: 3,
            lastFinalHash: validDocs[2].hash
        };

        const result = await verifyIntegrity(deletedDocs, systemState);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes("Doc count mismatch"))).toBe(true);
    });

    it("Detects Broken Hash Chain", async () => {
        // Modify doc[1].prevHash to test chain link
        const brokenDocs = JSON.parse(JSON.stringify(validDocs));
        brokenDocs[1].prevHash = "INVALID_HASH";
        // We also update its hash so it matches its NEW content, but the chain is broken relative to doc[0]
        brokenDocs[1].hash = await generateValidHash(brokenDocs[1]);

        const systemState = { totalDocs: 3, lastFinalHash: validDocs[2].hash };

        const result = await verifyIntegrity(brokenDocs, systemState);
        expect(result.valid).toBe(false);
        // It should detect broken chain or hash mismatch
        // In this specific case:
        // doc[1].prevHash (INVALID) != doc[0].hash (REAL) -> Error
        expect(result.errors.some(e => e.includes("Broken Chain"))).toBe(true);
    });
});
