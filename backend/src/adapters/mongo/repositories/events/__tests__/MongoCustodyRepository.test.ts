import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoCustodyRepository } from "../MongoCustodyRepository";
import { CustodyEntryModel } from "../../../models/CustodyEntryModel";
import type { CustodyEntry } from "../../../../../domain/events/model/child/CustodyEntry";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";

describe("MongoCustodyRepository", () => {
    let repository: MongoCustodyRepository;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoCustodyRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await CustodyEntryModel.deleteMany({});
    });

    const mockEntries: CustodyEntry[] = [
        {
            id: "entry-1",
            childId: "child-123",
            date: "2026-03-01",
            startTime: "00:00",
            endTime: "23:59",
            assignedTo: "MOM",
            isRecurring: true,
            priority: 0,
            sourceRuleId: "rule-1"
        },
        {
            id: "entry-2",
            childId: "child-123",
            date: "2026-03-02",
            startTime: "00:00",
            endTime: "23:59",
            assignedTo: "DAD",
            isRecurring: true,
            priority: 0,
            sourceRuleId: "rule-1"
        },
        {
            id: "entry-3",
            childId: "child-999",
            date: "2026-03-01",
            startTime: "00:00",
            endTime: "23:59",
            assignedTo: "DAD",
            isRecurring: false,
            priority: 10
        }
    ];

    it("should save and retrieve entries by date range", async () => {
        await repository.save(mockEntries);

        const found = await repository.findByDateRange("child-123", "2026-03-01", "2026-03-02");
        expect(found.length).toBe(2);
        expect(found.every(e => e.childId === "child-123")).toBe(true);
        expect(found.map(e => e.id)).toContain("entry-1");
        expect(found.map(e => e.id)).toContain("entry-2");
    });

    it("should retrieve entries for all children if childId is undefined", async () => {
        await repository.save(mockEntries);

        const found = await repository.findByDateRange(undefined, "2026-03-01", "2026-03-01");
        expect(found.length).toBe(2);

        const childIds = found.map(e => e.childId);
        expect(childIds).toContain("child-123");
        expect(childIds).toContain("child-999");
    });

    it("should update existing entries on save (upsert behavior)", async () => {
        await repository.save([mockEntries[0]]);

        const updatedEntry = { ...mockEntries[0], assignedTo: "DAD" as const };
        await repository.save([updatedEntry]);

        const found = await repository.findByDateRange("child-123", "2026-03-01", "2026-03-01");
        expect(found.length).toBe(1);
        expect(found[0].assignedTo).toBe("DAD");
    });

    it("should delete entries by rule matching", async () => {
        await repository.save(mockEntries);

        await repository.deleteByRuleId("rule-1");

        const remaining = await repository.findByDateRange(undefined, "2026-01-01", "2026-12-31");
        expect(remaining.length).toBe(1);
        expect(remaining[0].id).toBe("entry-3");
    });

    it("should update priority by rule ID", async () => {
        await repository.save(mockEntries);

        await repository.updatePriorityByRuleId("rule-1", 5);

        const found = await repository.findByDateRange("child-123", "2026-03-01", "2026-03-02");
        expect(found.every(e => e.priority === 5)).toBe(true);
    });

    it("should delete all entries", async () => {
        await repository.save(mockEntries);

        await repository.deleteAll();

        const remaining = await repository.findByDateRange(undefined, "2026-01-01", "2026-12-31");
        expect(remaining.length).toBe(0);
    });

    it("should ignore empty save input", async () => {
        await repository.save([]);
        const remaining = await repository.findByDateRange(undefined, "2026-01-01", "2026-12-31");
        expect(remaining.length).toBe(0);
    });
});
