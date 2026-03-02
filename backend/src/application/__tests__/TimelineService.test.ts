import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { RealDateProvider } from "../../adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "../../adapters/secondary/RealUuidProvider";
import type { CreateTimelineItemDto, MedicalVisitItem, MedsItem, NoteItem, IncidentItem, EncryptedTimelineItem } from "../../core/domain/TimelineItem";
import type { ICryptoService } from "../../core/ports/ICryptoService";
import type { Model } from "mongoose";
import type { IFamily } from "../../models/Family";

// Mock Crypto Service that just returns a predictable string
class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
    async encryptRSA(plaintext: string, publicKey: string): Promise<string> {
        return `encrypted-${plaintext.substring(0, 10)}-with-${publicKey}`;
    }
}

describe("TimelineService", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;
    let mockFamilyModel: Partial<Model<IFamily>>;
    let mockForensicService: any;
    let mockChildRepository: any;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        // Setup mock family model that returns 2 valid parent public keys
        mockFamilyModel = {
            findById: vi.fn().mockResolvedValue({
                parentPublicKeys: [
                    { parentId: "mom-1", rsaPublicKeyBase64: "mom-pub-key" },
                    { parentId: "dad-1", rsaPublicKeyBase64: "dad-pub-key" }
                ]
            })
        };

        mockForensicService = {
            createPendingDocument: vi.fn().mockResolvedValue(true)
        };

        mockChildRepository = {
            findById: vi.fn().mockImplementation((id: string) => Promise.resolve({ id, familyId: 'family1' }))
        };

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            new MockCryptoService(),
            mockFamilyModel as Model<IFamily>,
            mockForensicService,
            mockChildRepository
        );
    });

    describe("createItem", () => {
        it("should create a valid medical visit item (encrypted)", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                createdBy: "user-123",
                doctor: "Dr. Smith",
                diagnosis: "Common cold",
                recommendations: "Rest and fluids",
                attachments: [],
                childIds: ["child-1"],
                childId: "child-1",
            } as CreateTimelineItemDto & { childId: string };

            const item = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

            expect(item.id).toBeDefined();
            expect(item.createdAt).toBeDefined();
            expect(item.type).toBe("MEDICAL_VISIT");

            // Should be encrypted, so doctor/diagnosis fields shouldn't be present at top level
            expect((item as any).doctor).toBeUndefined();
            expect(item.encryptedPayload).toBeDefined();
            expect(item.encryptedPayload.encryptedForMom).toContain("encrypted-{\"doctor\":");
        });

        it("should create a medication item", async () => {
            const dto = {
                type: "MEDS",
                date: "2026-01-27",
                createdBy: "user-123",
                medicineName: "Aspirin",
                dosage: "500mg",
                administered: false,
                childIds: ["child-1"],
                childId: "child-1",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any as CreateTimelineItemDto & { childId: string };

            const item = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

            expect(item.type).toBe("MEDS");
            expect(item.encryptedPayload).toBeDefined();
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
                childIds: ["child-1"],
                childId: "child-1",
            } as CreateTimelineItemDto & { childId: string };

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
                childIds: ["child-1"],
                childId: "child-1",
            } as CreateTimelineItemDto & { childId: string };

            const item = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
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
                childId: "child-1",
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
                childIds: ["child-1"],
                childId: "child-1",
            } as CreateTimelineItemDto & { childId: string };

            const item = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
            expect(item.type).toBe("INCIDENT");
            expect(item.encryptedPayload).toBeDefined();
        });
    });

    describe("getItemsByDate", () => {
        it("should return items sorted by creation time (newest first)", async () => {
            const dto1 = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                content: "First note",
                childIds: ["child-1"],
                childId: "child-1",
            } as unknown as CreateTimelineItemDto & { childId: string };

            const dto2 = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                content: "Second note",
                childIds: ["child-1"],
                childId: "child-1",
            } as unknown as CreateTimelineItemDto & { childId: string };

            await service.createItem(dto1);
            await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
            const item2 = await service.createItem(dto2);

            const items = await service.getItemsByDate("2026-01-27");

            expect(items).toHaveLength(2);
            expect(items[0].id).toBe(item2.id); // Newest first
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
        it("should update and re-encrypt item", async () => {
            const dto = {
                type: "MEDS",
                date: "2026-01-27",
                createdBy: "user-123",
                medicineName: "Aspirin",
                dosage: "500mg",
                administered: false,
                childIds: ["child-1"],
                childId: "child-1",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any as CreateTimelineItemDto & { childId: string };

            const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

            const updatedPlaintext = {
                ...dto,
                id: created.id,
                administered: true,
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            const updated = await service.updateItem(created.id, updatedPlaintext, "user-123", "child-1", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "user123-name");

            expect(updated.encryptedPayload).toBeDefined();
            expect(updated.auditTrail.length).toBe(2);
            expect(updated.auditTrail[1].action).toBe("UPDATED");
        });

        it("should throw error when updating non-existent item", async () => {
            await expect(
                service.updateItem("non-existent-id", {} as any, "user-123", "child-1", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "user123-name")
            ).rejects.toThrow("Timeline item with id non-existent-id not found");
        });

        it("should throw error when non-owner tries to update", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "owner-id",
                content: "Secret note",
                childIds: ["child-1"],
                childId: "child-1",
            } as unknown as CreateTimelineItemDto & { childId: string };

            const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
            await expect(
                service.updateItem(created.id, { content: "Hacked" } as any, "other-id", "child-1", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "other-name")
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
                childIds: ["child-1"],
                childId: "child-1",
            } as unknown as CreateTimelineItemDto & { childId: string };

            const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
            await service.deleteItem(created.id, "user-123", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "user-123-name");

            const items = await service.getItemsByDate("2026-01-27");
            expect(items).toHaveLength(0);
        });

        it("should throw error when deleting non-existent item", async () => {
            await expect(service.deleteItem("non-existent-id", "user-123", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "user-123-name")).rejects.toThrow(
                "Timeline item with id non-existent-id not found"
            );
        });

        it("should throw error when non-owner tries to delete", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "owner-id",
                content: "To be deleted",
                childIds: ["child-1"],
                childId: "child-1",
            } as unknown as CreateTimelineItemDto & { childId: string };

            const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
            await expect(
                service.deleteItem(created.id, "other-id", "mock-sig", "2024-01-01T12:00:00.000Z", "key1", "other-name")
            ).rejects.toThrow("Unauthorized: You can only delete your own items");
        });
    });
});
