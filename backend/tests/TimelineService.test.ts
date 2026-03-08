import { describe, it, expect, beforeEach } from "vitest";
import { TimelineServiceImpl } from "../src/domain/events/service/TimelineService";
import { InMemoryTimelineRepository } from "../src/adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { RealDateProvider } from "../src/shared/providers/RealDateProvider";
import { RealUuidProvider } from "../src/shared/providers/RealUuidProvider";

describe("TimelineService - getItemsByDateRange", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;

    const mockCrypto = {
        verifySignature: async () => true,
        getFingerprint: async () => "fp",
        encryptRSA: async (plaintext: string) => plaintext,
    } as any;

    const mockFamilyModel = {
        findById: async () => ({ parentPublicKeys: [] })
    } as any;

    const mockChildRepository = {
        findById: async () => ({ id: "child-1", familyId: "family-1" })
    } as any;

    const mockForensicIntentRepository = {
        save: async () => undefined
    } as any;

    const mockTaskManager = {
        schedule: async () => ({ id: "task-1" })
    } as any;

    const encrypted = (item: Record<string, unknown>) => ({
        ...item,
        encryption: "ENCRYPTED" as const,
        encryptedPayload: { "user1": "ciphertext" }
    } as any);

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            mockCrypto,
            mockFamilyModel,
            mockChildRepository,
            mockForensicIntentRepository,
            mockTaskManager
        );
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

        const item1 = encrypted({
            id: "1",
            type: "NOTE",
            date: "2026-01-20",
            content: "Later date, earlier time",
            createdAt: earlier.toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        const item2 = encrypted({
            id: "2",
            type: "NOTE",
            date: "2026-01-10",
            content: "Earlier date",
            createdAt: now.toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        const item3 = encrypted({
            id: "3",
            type: "NOTE",
            date: "2026-01-20",
            content: "Later date, later time",
            createdAt: later.toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        await repository.save(item1 as any);
        await repository.save(item2 as any);
        await repository.save(item3 as any);

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
        const medicalVisit = encrypted({
            id: "1",
            type: "MEDICAL_VISIT",
            date: "2026-01-15",
            doctor: "Dr. Smith",
            diagnosis: "Annual checkup",
            attachments: [],
            createdAt: new Date().toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        const medication = encrypted({
            id: "2",
            type: "MEDS",
            date: "2026-01-16",
            medicineName: "Vitamin D",
            dosage: "1000 IU",
            administered: true,
            createdAt: new Date().toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        const handover = encrypted({
            id: "3",
            type: "HANDOVER",
            date: "2026-01-17",
            location: "Park",
            time: "14:00",
            status: "COMPLETED",
            createdAt: new Date().toISOString(),
            createdBy: "user1",
            auditTrail: [],
            isDeleted: false,
            childIds: [],
        });

        await repository.save(medicalVisit as any);
        await repository.save(medication as any);
        await repository.save(handover as any);

        // Act
        const items = await service.getItemsByDateRange("2026-01-01", "2026-01-31");

        // Assert
        expect(items).toHaveLength(3);
        expect(items[0].type).toBe("MEDICAL_VISIT");
        expect(items[1].type).toBe("MEDS");
        expect(items[2].type).toBe("HANDOVER");
    });
});
