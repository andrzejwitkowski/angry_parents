import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoTimelineRepository } from "../MongoTimelineRepository";
import { TimelineItemModel } from "../../../models/TimelineItemModel";
import type { TimelineItem } from "../../../../../domain/events/model/TimelineItem";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";

const proofReadyItem = {
    id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
    type: "NOTE",
    date: "2026-03-10",
    createdAt: "2026-03-10T10:30:00.000Z",
    createdBy: "dad-1",
    createdByName: "Alice",
    auditTrail: [{
        timestamp: "2026-03-10T10:30:00.000Z",
        userId: "dad-1",
        userName: "Alice",
        action: "CREATED",
    }],
    isDeleted: false,
    childIds: ["child-1"],
    encryption: "ENCRYPTED" as const,
    encryptedPayload: {
        "dad-1": "ciphertext-v1",
    },
    eventVersion: 1,
    versionHistory: [{
        version: 1,
        snapshot: {
            id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
            type: "NOTE",
            date: "2026-03-10",
            createdAt: "2026-03-10T10:30:00.000Z",
            createdBy: "dad-1",
            createdByName: "Alice",
            auditTrail: [{
                timestamp: "2026-03-10T10:30:00.000Z",
                userId: "dad-1",
                userName: "Alice",
                action: "CREATED",
            }],
            isDeleted: false,
            childIds: ["child-1"],
            encryption: "ENCRYPTED" as const,
            encryptedPayload: {
                "dad-1": "ciphertext-v1",
            },
        },
        proofHistory: [],
    }],
};

const encrypted = (data: Record<string, unknown>) => ({
    ...data,
    encryption: "ENCRYPTED" as const,
    encryptedPayload: { "user-1": "ciphertext" }
});

describe("MongoTimelineRepository", () => {
    let repository: MongoTimelineRepository;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoTimelineRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await TimelineItemModel.deleteMany({});
    });

    const mockItem: TimelineItem = encrypted({
        id: "timeline-123",
        date: "2026-03-01",
        type: "NOTE",
        content: "Test Note",
        createdAt: new Date().toISOString(),
        createdBy: "user-1",
        createdByName: "Mom",
        auditTrail: [{ action: "CREATED", timestamp: new Date().toISOString(), userId: "user-1", userName: "Mom" }],
        isDeleted: false,
        childIds: ["child-1"]
    }) as any;

    it("should save and retrieve by id", async () => {
        await repository.save(mockItem as any);

        const found = await repository.findById(mockItem.id);
        expect(found).not.toBeNull();
        expect(found?.type).toBe("NOTE");
        expect((found as any).content).toBe("Test Note");
        expect(found?.childIds).toContain("child-1");
    });

    it("should return null for deleted item using findById", async () => {
        await repository.save({ ...mockItem, isDeleted: true } as any);

        const found = await repository.findById(mockItem.id);
        expect(found).toBeNull();
    });

    it("returns typed encrypted items without double casting", async () => {
        await repository.save(mockItem as any);

        const found = await repository.findByIdIncludingDeleted(mockItem.id);

        expect(found?.encryption).toBe("ENCRYPTED");
        expect(found?.encryptedPayload).toEqual({ "user-1": "ciphertext" });
    });

    it("should find items by date", async () => {
        await repository.save(mockItem as any);

        await repository.save({
            ...mockItem,
            id: "timeline-456",
            date: "2026-03-02",
        } as any);

        const found = await repository.findByDate("2026-03-01");
        expect(found.length).toBe(1);
        expect(found[0].id).toBe("timeline-123");
    });

    it("should find items by date range ignoring deleted ones", async () => {
        await repository.save(mockItem as any);

        await repository.save({
            ...mockItem,
            id: "timeline-456",
            date: "2026-03-02",
        } as any);

        await repository.save({
            ...mockItem,
            id: "timeline-789",
            date: "2026-03-01",
            isDeleted: true
        } as any);

        const found = await repository.findByDateRange("2026-03-01", "2026-03-02");
        expect(found.length).toBe(2);

        const ids = found.map(i => i.id);
        expect(ids).toContain("timeline-123");
        expect(ids).toContain("timeline-456");
        expect(ids).not.toContain("timeline-789");
    });

    it("should update a timeline item", async () => {
        await repository.save(mockItem as any);

        const updated = await repository.update(mockItem.id, { createdByName: "Updated Mom", childIds: ["child-1", "child-2"] } as any);

        expect(updated.createdByName).toBe("Updated Mom");
        expect(updated.childIds).toContain("child-2");

        const found = await repository.findById(mockItem.id);
        expect(found?.createdByName).toBe("Updated Mom");
    });

    it("should soft delete an item", async () => {
        await repository.save(mockItem as any);

        await repository.delete(mockItem.id);

        const found = await repository.findById(mockItem.id);
        expect(found).toBeNull();

        const rawDoc = await TimelineItemModel.findOne({ id: mockItem.id });
        expect(rawDoc?.isDeleted).toBe(true);
    });

    it("should count items by childId ignoring deleted ones", async () => {
        await repository.save(mockItem as any);
        await repository.save({
            ...mockItem,
            id: "timeline-456",
            childIds: ["child-1", "child-2"]
        } as any);

        await repository.save({
            ...mockItem,
            id: "timeline-789",
            isDeleted: true
        } as any);

        const count1 = await repository.countByChildId("child-1");
        expect(count1).toBe(2);

        const count2 = await repository.countByChildId("child-2");
        expect(count2).toBe(1);
    });

    it("should throw when updating non-existent item", async () => {
        await expect(repository.update("missing-id", { createdByName: "x" } as any)).rejects.toThrow("not found");
    });

    it("should throw when deleting non-existent item", async () => {
        await expect(repository.delete("missing-id")).rejects.toThrow("not found");
    });

    it("claims a pending proof exactly once for the same item, version, and hash", async () => {
        await repository.save(proofReadyItem as any);

        const firstClaim = await (repository as any).claimPendingProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-1",
        });
        const secondClaim = await (repository as any).claimPendingProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-1",
        });

        expect(firstClaim).toBe(true);
        expect(secondClaim).toBe(false);

        const stored = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(stored?.versionHistory[0].proofHistory).toEqual([
            {
                version: 1,
                hash: "hash-1",
            },
        ]);
    });

    it("allows final proof metadata to merge into an already claimed proof entry", async () => {
        await repository.save(proofReadyItem as any);

        await (repository as any).claimPendingProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-2",
        });

        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-2",
            txHash: "0xabc",
            blockNumber: "42",
            anchoredAt: "2026-03-10T12:00:00.000Z",
        });

        const stored = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(stored?.versionHistory[0].proofHistory).toEqual([
            {
                version: 1,
                hash: "hash-2",
                txHash: "0xabc",
                blockNumber: "42",
                anchoredAt: "2026-03-10T12:00:00.000Z",
            },
        ]);
    });

    it("preserves anchored proof metadata when a later partial update for the same hash arrives", async () => {
        await repository.save(proofReadyItem as any);

        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-3",
            txHash: "0xdef",
            blockNumber: "77",
            anchoredAt: "2026-03-10T15:00:00.000Z",
        });

        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 1,
            hash: "hash-3",
        });

        const stored = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(stored?.versionHistory[0].proofHistory).toEqual([
            {
                version: 1,
                hash: "hash-3",
                txHash: "0xdef",
                blockNumber: "77",
                anchoredAt: "2026-03-10T15:00:00.000Z",
            },
        ]);
    });
});
