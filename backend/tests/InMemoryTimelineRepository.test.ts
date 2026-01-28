import { describe, it, expect, beforeEach } from "bun:test";
import { InMemoryTimelineRepository } from "../src/adapters/secondary/InMemoryTimelineRepository";
import type { TimelineItem } from "../src/core/domain/TimelineItem";

describe("InMemoryTimelineRepository - findByDateRange", () => {
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
    });

    it("should return empty array when no items exist in range", async () => {
        const items = await repository.findByDateRange("2026-01-01", "2026-01-31");
        expect(items).toEqual([]);
    });

    it("should return items within the date range", async () => {
        // Arrange
        const item1: TimelineItem = {
            id: "1",
            type: "NOTE",
            date: "2026-01-15",
            content: "Test note 1",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        const item2: TimelineItem = {
            id: "2",
            type: "NOTE",
            date: "2026-01-20",
            content: "Test note 2",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        const item3: TimelineItem = {
            id: "3",
            type: "NOTE",
            date: "2026-02-05",
            content: "Test note 3",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        await repository.save(item1);
        await repository.save(item2);
        await repository.save(item3);

        // Act
        const items = await repository.findByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(items).toHaveLength(2);
        expect(items.map(i => i.id)).toContain("1");
        expect(items.map(i => i.id)).toContain("2");
        expect(items.map(i => i.id)).not.toContain("3");
    });

    it("should include items on boundary dates", async () => {
        // Arrange
        const item1: TimelineItem = {
            id: "1",
            type: "NOTE",
            date: "2026-01-01",
            content: "Start date",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        const item2: TimelineItem = {
            id: "2",
            type: "NOTE",
            date: "2026-01-31",
            content: "End date",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
        };

        await repository.save(item1);
        await repository.save(item2);

        // Act
        const items = await repository.findByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(items).toHaveLength(2);
    });

    it("should return items from multiple dates in range", async () => {
        // Arrange
        const items: TimelineItem[] = [
            {
                id: "1",
                type: "MEDICAL_VISIT",
                date: "2026-01-10",
                doctor: "Dr. Smith",
                diagnosis: "Checkup",
                attachments: [],
                createdAt: new Date().toISOString(),
                createdBy: "user1",
            },
            {
                id: "2",
                type: "MEDS",
                date: "2026-01-10",
                medicineName: "Aspirin",
                dosage: "100mg",
                administered: false,
                createdAt: new Date().toISOString(),
                createdBy: "user1",
            },
            {
                id: "3",
                type: "HANDOVER",
                date: "2026-01-15",
                location: "School",
                time: "15:00",
                status: "PENDING",
                createdAt: new Date().toISOString(),
                createdBy: "user1",
            },
        ];

        for (const item of items) {
            await repository.save(item);
        }

        // Act
        const result = await repository.findByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(result).toHaveLength(3);
    });
});
