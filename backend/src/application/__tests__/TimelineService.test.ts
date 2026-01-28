import { describe, it, expect, beforeEach } from "bun:test";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import type { CreateTimelineItemDto, MedicalVisitItem, MedsItem, NoteItem, HandoverItem, IncidentItem } from "../../core/domain/TimelineItem";

describe("TimelineService", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
        service = new TimelineServiceImpl(repository);
    });

    describe("createItem", () => {
        it("should create a valid medical visit item", async () => {
            const dto: CreateTimelineItemDto = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                createdBy: "user-123",
                doctor: "Dr. Smith",
                diagnosis: "Common cold",
                recommendations: "Rest and fluids",
                attachments: [],
            } as CreateTimelineItemDto;

            const item = await service.createItem(dto);
            const medicalItem = item as MedicalVisitItem;

            expect(item.id).toBeDefined();
            expect(item.createdAt).toBeDefined();
            expect(item.type).toBe("MEDICAL_VISIT");
            expect(medicalItem.doctor).toBe("Dr. Smith");
        });

        it("should create a medication item", async () => {
            const dto: CreateTimelineItemDto = {
                type: "MEDS",
                date: "2026-01-27",
                createdBy: "user-123",
                medicineName: "Aspirin",
                dosage: "500mg",
                administered: false,
            };

            const item = await service.createItem(dto);
            const medicationItem = item as MedsItem;

            expect(item.type).toBe("MEDS");
            expect(medicationItem.administered).toBe(false);
        });

        it("should reject handover with past date", async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const pastDate = yesterday.toISOString().split("T")[0];

            const dto = {
                type: "HANDOVER",
                date: pastDate,
                createdBy: "user-123",
                location: "School",
                time: "15:00",
                status: "PENDING",
            } as CreateTimelineItemDto;

            await expect(service.createItem(dto)).rejects.toThrow(
                "Handover date cannot be in the past"
            );
        });

        it("should accept handover with today's date", async () => {
            const today = new Date().toISOString().split("T")[0];

            const dto = {
                type: "HANDOVER",
                date: today,
                createdBy: "user-123",
                location: "School",
                time: "15:00",
                status: "PENDING",
            } as CreateTimelineItemDto;

            const item = await service.createItem(dto);
            expect(item.type).toBe("HANDOVER");
        });

        it("should reject medical visit without diagnosis", async () => {
            const dto = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                createdBy: "user-123",
                doctor: "Dr. Smith",
                diagnosis: undefined,
                attachments: [],
            };

            // @ts-expect-error - testing invalid DTO
            await expect(service.createItem(dto)).rejects.toThrow();
        });

        it("should create an incident with severity", async () => {
            const dto = {
                type: "INCIDENT",
                date: "2026-01-27",
                createdBy: "user-123",
                severity: "HIGH",
                description: "Child fell from swing",
            } as CreateTimelineItemDto;

            const item = await service.createItem(dto);
            const incidentItem = item as IncidentItem;
            expect(item.type).toBe("INCIDENT");
            expect(incidentItem.severity).toBe("HIGH");
        });
    });

    describe("getItemsByDate", () => {
        it("should return items sorted by creation time (newest first)", async () => {
            const dto1 = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                content: "First note",
            } as CreateTimelineItemDto;

            const dto2 = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                content: "Second note",
            } as CreateTimelineItemDto;

            await service.createItem(dto1);
            await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
            await service.createItem(dto2);

            const items = await service.getItemsByDate("2026-01-27");

            expect(items).toHaveLength(2);
            expect((items[0] as NoteItem).content).toBe("Second note"); // Newest first
            expect((items[1] as NoteItem).content).toBe("First note");
        });

        it("should reject invalid date format", async () => {
            await expect(service.getItemsByDate("invalid-date")).rejects.toThrow(
                "Invalid date format"
            );
        });

        it("should return empty array for date with no items", async () => {
            const items = await service.getItemsByDate("2026-12-31");
            expect(items).toEqual([]);
        });
    });

    describe("updateItem", () => {
        it("should update medication administered status", async () => {
            const dto: CreateTimelineItemDto = {
                type: "MEDS",
                date: "2026-01-27",
                createdBy: "user-123",
                medicineName: "Aspirin",
                dosage: "500mg",
                administered: false,
            };

            const created = await service.createItem(dto);
            const updated = await service.updateItem(created.id, { administered: true }, "user-123");

            expect((updated as MedsItem).administered).toBe(true);
            expect((updated as MedsItem).medicineName).toBe("Aspirin");
        });

        it("should throw error when updating non-existent item", async () => {
            await expect(
                service.updateItem("non-existent-id", { administered: true }, "user-123")
            ).rejects.toThrow("Timeline item with id non-existent-id not found");
        });

        it("should throw error when non-owner tries to update", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "owner-id",
                content: "Secret note",
            } as CreateTimelineItemDto;

            const created = await service.createItem(dto);
            await expect(
                service.updateItem(created.id, { content: "Hacked" }, "other-id")
            ).rejects.toThrow("Unauthorized: You can only modify your own items");
        });
    });

    describe("deleteItem", () => {
        it("should delete an existing item", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                content: "Test note",
            } as CreateTimelineItemDto;

            const created = await service.createItem(dto);
            await service.deleteItem(created.id, "user-123");

            const items = await service.getItemsByDate("2026-01-27");
            expect(items).toHaveLength(0);
        });

        it("should throw error when deleting non-existent item", async () => {
            await expect(service.deleteItem("non-existent-id", "user-123")).rejects.toThrow(
                "Timeline item with id non-existent-id not found"
            );
        });

        it("should throw error when non-owner tries to delete", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "owner-id",
                content: "To be deleted",
            } as CreateTimelineItemDto;

            const created = await service.createItem(dto);
            await expect(
                service.deleteItem(created.id, "other-id")
            ).rejects.toThrow("Unauthorized: You can only delete your own items");
        });
    });
});
