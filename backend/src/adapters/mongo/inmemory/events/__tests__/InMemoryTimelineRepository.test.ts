import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTimelineRepository } from "../InMemoryTimelineRepository";

const encrypted = (data: Record<string, unknown>) => ({
    ...data,
    encryption: "ENCRYPTED" as const,
    encryptedPayload: { "user-123": "ciphertext" }
}) as any;

describe("InMemoryTimelineRepository", () => {
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
    });

    it("should save and retrieve items by date", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "MEDICAL_VISIT",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            doctor: "Dr. Smith",
            diagnosis: "Common cold",
            attachments: [],
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        await repository.save(item as any);
        const items = await repository.findByDate("2026-01-27");

        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(item.id);
        expect(items[0].type).toBe("MEDICAL_VISIT");
    });

    it("should return empty array for dates with no items", async () => {
        const items = await repository.findByDate("2026-12-31");
        expect(items).toEqual([]);
    });

    it("should find item by ID", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        await repository.save(item as any);
        const found = await repository.findById(item.id);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(item.id);
        expect(found?.type).toBe("MEDS");
    });

    it("should return null for non-existent ID", async () => {
        const found = await repository.findById("non-existent-id");
        expect(found).toBeNull();
    });

    it("should update existing items", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        await repository.save(item as any);
        const updated = await repository.update(item.id, { administered: true } as any);

        expect((updated as any).administered).toBe(true);
        expect((updated as any).medicineName).toBe("Aspirin");
    });

    it("should throw error when updating non-existent item", async () => {
        await expect(
            repository.update("non-existent-id", { administered: true } as any)
        ).rejects.toThrow("Item with id non-existent-id not found");
    });

    it("should delete items", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        await repository.save(item as any);
        await repository.delete(item.id);

        const found = await repository.findById(item.id);
        expect(found).toBeNull();

        const items = await repository.findByDate("2026-01-27");
        expect(items).toHaveLength(0);
    });

    it("should throw error when deleting non-existent item", async () => {
        await expect(repository.delete("non-existent-id")).rejects.toThrow(
            "Item with id non-existent-id not found"
        );
    });

    it("should store multiple items for the same date", async () => {
        const item1 = encrypted({
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        const item2 = encrypted({
            id: crypto.randomUUID(),
            type: "MEDICAL_VISIT",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            doctor: "Dr. House",
            diagnosis: "Flu",
            attachments: [],
            auditTrail: [],
            isDeleted: false,
            childIds: []
        });

        await repository.save(item1 as any);
        await repository.save(item2 as any);

        const items = await repository.findByDate("2026-01-27");
        expect(items).toHaveLength(2);
    });

    it("returns null for proof transition claims when the item or proof is missing", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "NOTE",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
            eventVersion: 1,
            versionHistory: [{
                version: 1,
                snapshot: {
                    id: "item-1",
                    type: "NOTE",
                    date: "2026-01-27",
                    createdAt: new Date().toISOString(),
                    createdBy: "user-123",
                    createdByName: "Tester",
                    auditTrail: [],
                    isDeleted: false,
                    childIds: [],
                    encryption: "ENCRYPTED",
                    encryptedPayload: { "user-123": "ciphertext" },
                },
                proofHistory: [],
            }],
        });

        await repository.save(item as any);

        await expect(repository.markProofTransitionInProgress("missing", 1, "hash")).resolves.toBeNull();
        await expect(repository.resetProofTransitionClaim("missing", 1, "hash")).resolves.toBeNull();
        await expect(repository.markProofTransitionInProgress(item.id, 1, "hash")).resolves.toBeNull();
        await expect(repository.resetProofTransitionClaim(item.id, 1, "hash")).resolves.toBeNull();
    });

    it("returns a defensive copy from replaceProofRecord", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "NOTE",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            createdByName: "Tester",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
            eventVersion: 1,
            versionHistory: [{
                version: 1,
                snapshot: {
                    id: "item-2",
                    type: "NOTE",
                    date: "2026-01-27",
                    createdAt: new Date().toISOString(),
                    createdBy: "user-123",
                    createdByName: "Tester",
                    auditTrail: [],
                    isDeleted: false,
                    childIds: [],
                    encryption: "ENCRYPTED",
                    encryptedPayload: { "user-123": "ciphertext" },
                },
                proofHistory: [{
                    version: 1,
                    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    status: "CLAIMED",
                }],
            }],
        });

        await repository.save(item as any);

        const replaced = await repository.replaceProofRecord(item.id, {
            version: 1,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "SUBMITTED",
            submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        } as any);

        replaced.versionHistory[0].proofHistory[0].status = "FAILED" as any;

        const stored = await repository.findByIdIncludingDeleted(item.id);
        expect(stored?.versionHistory[0].proofHistory[0]).toMatchObject({
            status: "SUBMITTED",
            submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        });
    });

    it("atomically confirms a pending proof once", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "NOTE",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            createdByName: "Tester",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
            eventVersion: 1,
            versionHistory: [{
                version: 1,
                snapshot: {
                    id: crypto.randomUUID(),
                    type: "NOTE",
                    date: "2026-01-27",
                    createdAt: new Date().toISOString(),
                    createdBy: "user-123",
                    createdByName: "Tester",
                    auditTrail: [],
                    isDeleted: false,
                    childIds: [],
                    encryption: "ENCRYPTED",
                    encryptedPayload: { "user-123": "ciphertext" },
                },
                proofHistory: [{
                    version: 1,
                    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    status: "SUBMITTED",
                    submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    lastAttemptAt: "2026-03-12T11:55:00.000Z",
                }],
            }],
        });

        await repository.save(item as any);

        const confirmed = await repository.confirmProofAtomically(item.id, {
            version: 1,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "CONFIRMED",
            submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            blockNumber: "44",
            anchoredAt: "2026-03-12T12:00:00.000Z",
        } as any);

        expect(confirmed?.versionHistory[0].proofHistory).toEqual([
            {
                version: 1,
                hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "CONFIRMED",
                submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                lastAttemptAt: "2026-03-12T11:55:00.000Z",
                txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                blockNumber: "44",
                anchoredAt: "2026-03-12T12:00:00.000Z",
            }
        ]);

        await expect(repository.confirmProofAtomically(item.id, {
            version: 1,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "CONFIRMED",
            submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            blockNumber: "44",
            anchoredAt: "2026-03-12T12:00:00.000Z",
        } as any)).resolves.toBeNull();
    });

    it("allows only one concurrent in-memory atomic confirmation", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "NOTE",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            createdByName: "Tester",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
            eventVersion: 1,
            versionHistory: [{
                version: 1,
                snapshot: {
                    id: crypto.randomUUID(),
                    type: "NOTE",
                    date: "2026-01-27",
                    createdAt: new Date().toISOString(),
                    createdBy: "user-123",
                    createdByName: "Tester",
                    auditTrail: [],
                    isDeleted: false,
                    childIds: [],
                    encryption: "ENCRYPTED",
                    encryptedPayload: { "user-123": "ciphertext" },
                },
                proofHistory: [{
                    version: 1,
                    hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                    status: "RECONCILING",
                    submittedTxHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                    lastAttemptAt: "2026-03-12T11:55:00.000Z",
                }],
            }],
        });

        await repository.save(item as any);

        const [first, second] = await Promise.all([
            repository.confirmProofAtomically(item.id, {
                version: 1,
                hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                status: "CONFIRMED",
                submittedTxHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                blockNumber: "66",
                anchoredAt: "2026-03-12T12:00:00.000Z",
                lastAttemptAt: "2026-03-12T11:55:00.000Z",
            } as any),
            repository.confirmProofAtomically(item.id, {
                version: 1,
                hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                status: "CONFIRMED",
                submittedTxHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                blockNumber: "66",
                anchoredAt: "2026-03-12T12:00:00.000Z",
                lastAttemptAt: "2026-03-12T11:55:00.000Z",
            } as any),
        ]);

        expect([first, second].filter(Boolean)).toHaveLength(1);
        expect([first, second]).toContain(null);
    });

    it("returns null when atomic confirmation loses to an existing confirmed proof", async () => {
        const item = encrypted({
            id: crypto.randomUUID(),
            type: "NOTE",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            createdByName: "Tester",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
            eventVersion: 1,
            versionHistory: [{
                version: 1,
                snapshot: {
                    id: crypto.randomUUID(),
                    type: "NOTE",
                    date: "2026-01-27",
                    createdAt: new Date().toISOString(),
                    createdBy: "user-123",
                    createdByName: "Tester",
                    auditTrail: [],
                    isDeleted: false,
                    childIds: [],
                    encryption: "ENCRYPTED",
                    encryptedPayload: { "user-123": "ciphertext" },
                },
                proofHistory: [
                    {
                        version: 1,
                        hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        status: "SUBMITTED",
                        submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        lastAttemptAt: "2026-03-12T11:55:00.000Z",
                    },
                    {
                        version: 1,
                        hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                        status: "CONFIRMED",
                        submittedTxHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                        txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                        blockNumber: "55",
                        anchoredAt: "2026-03-12T11:00:00.000Z",
                    }
                ],
            }],
        });

        await repository.save(item as any);

        await expect(repository.confirmProofAtomically(item.id, {
            version: 1,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "CONFIRMED",
            submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            blockNumber: "44",
            anchoredAt: "2026-03-12T12:00:00.000Z",
        } as any)).resolves.toBeNull();
    });
});
