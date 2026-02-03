import { describe, it, expect, beforeEach } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import type { CreateTimelineItemDto } from "../../core/domain/TimelineItem";

describe("Timeline Audit System", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
        service = new TimelineServiceImpl(repository);
    });

    it("should create an item with initial audit trail", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            createdByName: "Alice",
            content: "Hello",
            childIds: [],
        } as CreateTimelineItemDto;

        const item = await service.createItem(dto);

        expect(item.auditTrail).toHaveLength(1);
        expect(item.auditTrail[0].action).toBe("CREATED");
        expect(item.auditTrail[0].userId).toBe("user-1");
        expect(item.auditTrail[0].userName).toBe("Alice");
        expect(item.isDeleted).toBe(false);
    });

    it("should track multiple updates in the audit trail", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            createdByName: "Alice",
            content: "Initial content",
            childIds: [],
        } as CreateTimelineItemDto;

        const created = await service.createItem(dto);

        // First update
        const updated1 = await service.updateItem(created.id, { content: "Updated once" }, "user-1", "Alice");

        // Second update
        const updated2 = await service.updateItem(created.id, { content: "Updated twice" }, "user-1", "Alice");

        expect(updated2.auditTrail).toHaveLength(3);
        expect(updated2.auditTrail[1].action).toBe("UPDATED");
        expect(updated2.auditTrail[1].changes).toEqual({ content: "Updated once" });
        expect(updated2.auditTrail[2].changes).toEqual({ content: "Updated twice" });
    });

    it("should track who made the update", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            createdByName: "Alice",
            content: "Initial content",
            childIds: [],
        } as CreateTimelineItemDto;

        const created = await service.createItem(dto);

        // Update by the same user (owner)
        const updated = await service.updateItem(created.id, { content: "Changed" }, "user-1", "Alice");

        expect(updated.auditTrail[1].userId).toBe("user-1");
        expect(updated.auditTrail[1].userName).toBe("Alice");
    });

    it("should perform soft delete and record it in audit trail", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            createdByName: "Alice",
            content: "Delete me",
            childIds: [],
        } as CreateTimelineItemDto;

        const created = await service.createItem(dto);
        await service.deleteItem(created.id, "user-1", "Alice");

        // Verify it's gone from normal queries
        const items = await service.getItemsByDate("2026-02-03");
        expect(items).toHaveLength(0);

        // Verify it still exists in repository with audit trail
        const inRepo = await repository.findById(created.id);
        expect(inRepo).not.toBeNull();
        expect(inRepo?.isDeleted).toBe(true);
        expect(inRepo?.auditTrail).toHaveLength(2);
        expect(inRepo?.auditTrail[1].action).toBe("DELETED");
        expect(inRepo?.auditTrail[1].userName).toBe("Alice");
    });

    it("should only track actual changes in update", async () => {
        const dto: CreateTimelineItemDto = {
            type: "MEDS",
            date: "2026-02-03",
            createdBy: "user-1",
            medicineName: "Advil",
            dosage: "200mg",
            administered: false,
            childIds: [],
        } as CreateTimelineItemDto;

        const created = await service.createItem(dto);

        // Update with SAME values
        const updated = await service.updateItem(created.id, { administered: false }, "user-1", "Alice");

        // Audit trail should NOT increase
        expect(updated.auditTrail).toHaveLength(1);
    });
});
