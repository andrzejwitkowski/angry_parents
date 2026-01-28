import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTimelineRepository } from "../InMemoryTimelineRepository";
import type { TimelineItem, MedicalVisitItem, MedsItem } from "../../../core/domain/TimelineItem";

describe("InMemoryTimelineRepository", () => {
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
    });

    it("should save and retrieve items by date", async () => {
        const item: MedicalVisitItem = {
            id: crypto.randomUUID(),
            type: "MEDICAL_VISIT",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            doctor: "Dr. Smith",
            diagnosis: "Common cold",
            attachments: [],
        };

        await repository.save(item);
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
        const item: MedsItem = {
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
        };

        await repository.save(item);
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
        const item: MedsItem = {
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
        };

        await repository.save(item);
        const updated = await repository.update(item.id, { administered: true });

        expect(updated.administered).toBe(true);
        expect(updated.medicineName).toBe("Aspirin");
    });

    it("should throw error when updating non-existent item", async () => {
        await expect(
            repository.update("non-existent-id", { administered: true })
        ).rejects.toThrow("Item with id non-existent-id not found");
    });

    it("should delete items", async () => {
        const item: MedsItem = {
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
        };

        await repository.save(item);
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
        const item1: MedsItem = {
            id: crypto.randomUUID(),
            type: "MEDS",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            medicineName: "Aspirin",
            dosage: "500mg",
            administered: false,
        };

        const item2: MedicalVisitItem = {
            id: crypto.randomUUID(),
            type: "MEDICAL_VISIT",
            date: "2026-01-27",
            createdAt: new Date().toISOString(),
            createdBy: "user-123",
            doctor: "Dr. House",
            diagnosis: "Flu",
            attachments: [],
        };

        await repository.save(item1);
        await repository.save(item2);

        const items = await repository.findByDate("2026-01-27");
        expect(items).toHaveLength(2);
    });
});
