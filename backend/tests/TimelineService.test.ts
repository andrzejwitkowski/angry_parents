import { describe, it, expect, beforeEach } from "vitest";
import { TimelineServiceImpl } from "../src/application/TimelineService";
import { InMemoryTimelineRepository } from "../src/adapters/secondary/InMemoryTimelineRepository";
import type { TimelineItem } from "../src/core/domain/TimelineItem";

describe("TimelineService - getItemsByDateRange", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
        service = new TimelineServiceImpl(repository);
    });

    it("should validate date format and throw error for invalid dates", async () => {
        await expect(
            service.getItemsByDateRange("invalid", "2026-01-31")
        ).rejects.toThrow("Invalid date format");

        await expect(
            service.getItemsByDateRange("2026-01-01", "not-a-date")
        ).rejects.toThrow("Invalid date format");
    });

    it("should return empty array when no items in range", async () => {
        const items = await service.getItemsByDateRange("2026-01-01", "2026-01-31");
        expect(items).toEqual([]);
    });

    it("should return items sorted by date ascending, then creation time descending", async () => {
        // Arrange - Create items with different dates and times
        const now = new Date();
        const earlier = new Date(now.getTime() - 1000);
        const later = new Date(now.getTime() + 1000);

        const item1: TimelineItem = {
            id: "1",
            type: "NOTE",
            date: "2026-01-20",
            content: "Later date, earlier time",
            createdAt: earlier.toISOString(),
            createdBy: "user1",
        };

        const item2: TimelineItem = {
            id: "2",
            type: "NOTE",
            date: "2026-01-10",
            content: "Earlier date",
            createdAt: now.toISOString(),
            createdBy: "user1",
        };

        const item3: TimelineItem = {
            id: "3",
            type: "NOTE",
            date: "2026-01-20",
            content: "Later date, later time",
            createdAt: later.toISOString(),
            createdBy: "user1",
        };

        await repository.save(item1);
        await repository.save(item2);
        await repository.save(item3);

        // Act
        const items = await service.getItemsByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(items).toHaveLength(3);
        // Should be sorted by date first (2026-01-10, then 2026-01-20)
        expect(items[0].id).toBe("2"); // Earlier date
        // Within same date, newer creation time first
        expect(items[1].id).toBe("3"); // Later date, later creation time
        expect(items[2].id).toBe("1"); // Later date, earlier creation time
    });

    it("should handle multiple event types in range", async () => {
        // Arrange
        const medicalVisit: TimelineItem = {
            id: "1",
            type: "MEDICAL_VISIT",
            date: "2026-01-15",
            doctor: "Dr. Smith",
            diagnosis: "Annual checkup",
            attachments: [],
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        const medication: TimelineItem = {
            id: "2",
            type: "MEDS",
            date: "2026-01-16",
            medicineName: "Vitamin D",
            dosage: "1000 IU",
            administered: true,
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        const handover: TimelineItem = {
            id: "3",
            type: "HANDOVER",
            date: "2026-01-17",
            location: "Park",
            time: "14:00",
            status: "COMPLETED",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        await repository.save(medicalVisit);
        await repository.save(medication);
        await repository.save(handover);

        // Act
        const items = await service.getItemsByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(items).toHaveLength(3);
        expect(items[0].type).toBe("MEDICAL_VISIT");
        expect(items[1].type).toBe("MEDS");
        expect(items[2].type).toBe("HANDOVER");
    });
});
