import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoTimelineRepository } from "../MongoTimelineRepository";
import { TimelineItemModel } from "../../../models/TimelineItem";
import type { TimelineItem } from "../../../core/domain/TimelineItem";
import { connectMongoMemory, disconnectMongoMemory } from "./mongoMemoryServer";

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

    const mockItem: TimelineItem = {
        id: "timeline-123",
        date: "2026-03-01",
        type: "NOTE",
        content: "Test Note", // NoteItem specific
        createdAt: new Date().toISOString(),
        createdBy: "user-1",
        createdByName: "Mom",
        auditTrail: [{ action: "CREATED", timestamp: new Date().toISOString(), userId: "user-1", userName: "Mom" }],
        isDeleted: false,
        childIds: ["child-1"]
    } as any; // Cast as any because type discriminators can be strict in assignment

    it("should save and retrieve by id", async () => {
        await repository.save(mockItem);

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

    it("should find items by date", async () => {
        await repository.save(mockItem);

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
        await repository.save(mockItem);

        await repository.save({
            ...mockItem,
            id: "timeline-456",
            date: "2026-03-02",
        } as any);

        await repository.save({
            ...mockItem,
            id: "timeline-789",
            date: "2026-03-01",
            isDeleted: true // should be ignored
        } as any);

        const found = await repository.findByDateRange("2026-03-01", "2026-03-02");
        expect(found.length).toBe(2);

        const ids = found.map(i => i.id);
        expect(ids).toContain("timeline-123");
        expect(ids).toContain("timeline-456");
        expect(ids).not.toContain("timeline-789");
    });

    it("should update a timeline item", async () => {
        await repository.save(mockItem);

        const updated = await repository.update(mockItem.id, { createdByName: "Updated Mom", childIds: ["child-1", "child-2"] } as any);

        expect(updated.createdByName).toBe("Updated Mom");
        expect(updated.childIds).toContain("child-2");

        const found = await repository.findById(mockItem.id);
        expect(found?.createdByName).toBe("Updated Mom");
    });

    it("should soft delete an item", async () => {
        await repository.save(mockItem);

        await repository.delete(mockItem.id);

        const found = await repository.findById(mockItem.id);
        expect(found).toBeNull(); // findById ignores deleted items

        // Manual check in db
        const rawDoc = await TimelineItemModel.findOne({ id: mockItem.id });
        expect(rawDoc?.isDeleted).toBe(true);
    });

    it("should count items by childId ignoring deleted ones", async () => {
        await repository.save(mockItem);
        await repository.save({
            ...mockItem,
            id: "timeline-456",
            childIds: ["child-1", "child-2"]
        } as any);

        await repository.save({
            ...mockItem,
            id: "timeline-789",
            isDeleted: true // ignored
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
});
