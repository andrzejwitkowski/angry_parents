import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { RealDateProvider } from "../../adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "../../adapters/secondary/RealUuidProvider";
import type { CreateTimelineItemDto, EncryptedTimelineItem } from "../../core/domain/TimelineItem";
import type { ICryptoService } from "../../core/ports/ICryptoService";
import type { Model } from "mongoose";
import type { IFamily } from "../../models/Family";

// Mock Crypto Service (minimal since backend no longer encrypts)
class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
}

describe("TimelineService (E2EE)", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;
    let mockFamilyModel: Partial<Model<IFamily>>;
    let mockChildRepository: any;
    let mockForensicIntentRepository: any;
    let mockTaskManager: any;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        mockFamilyModel = {
            findById: vi.fn(),
        };

        mockChildRepository = {
            findById: vi.fn().mockImplementation((id: string) => Promise.resolve({
                id,
                familyId: 'family1',
            }))
        };

        mockForensicIntentRepository = {
            save: vi.fn().mockResolvedValue(undefined)
        };
        mockTaskManager = {
            schedule: vi.fn().mockResolvedValue({ id: "task-1" })
        };

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            new MockCryptoService(),
            mockFamilyModel as Model<IFamily>,
            mockChildRepository,
            mockForensicIntentRepository,
            mockTaskManager
        );
    });

    const mockEncryptedPayload = {
        "mom-1": "ciphertext-for-mom",
        "dad-1": "ciphertext-for-dad"
    };

    const signatureData = {
        signatureBase64: "mock-sig",
        timestamp: "2024-01-01T12:00:00.000Z",
        keyId: "key1"
    };

    describe("createItem", () => {
        it("should store a pre-encrypted timeline item", async () => {
            const dto: CreateTimelineItemDto & { signatureBase64: string; timestamp: string; keyId: string } = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                createdBy: "user-123",
                createdByName: "User Name",
                childIds: ["child-1"],
                encryptedPayload: mockEncryptedPayload,
                ...signatureData
            };

            const item = await service.createItem(dto);

            expect(item.id).toBeDefined();
            expect(item.createdAt).toBeDefined();
            expect(item.type).toBe("MEDICAL_VISIT");
            expect(item.encryption).toBe("ENCRYPTED");
            expect(item.encryptedPayload).toEqual(mockEncryptedPayload);

            // Verify it was saved
            const saved = await repository.findById(item.id);
            expect(saved).toBeDefined();
            expect(saved?.encryptedPayload).toEqual(mockEncryptedPayload);
        });

        it("should accept any metadata even if server cannot read content", async () => {
            const dto: CreateTimelineItemDto & typeof signatureData = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                childIds: ["child-1"],
                encryptedPayload: { "someone": "secret" },
                ...signatureData
            };

            const item = await service.createItem(dto);
            expect(item.type).toBe("NOTE");
            expect(item.encryptedPayload).toEqual({ "someone": "secret" });
        });
    });

    describe("updateItem", () => {
        it("should update metadata and encrypted payload", async () => {
            // Create first
            const initialDto: CreateTimelineItemDto & typeof signatureData = {
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                childIds: ["child-1"],
                encryptedPayload: { "mom": "old-secret" },
                ...signatureData
            };
            const created = await service.createItem(initialDto);

            // Update
            const updateDto: Partial<CreateTimelineItemDto> & typeof signatureData = {
                date: "2026-01-28",
                encryptedPayload: { "mom": "new-secret" },
                ...signatureData
            };

            const updated = await service.updateItem(created.id, updateDto, "user-123", "User Name");

            expect(updated.date).toBe("2026-01-28");
            expect(updated.encryptedPayload).toEqual({ "mom": "new-secret" });
            expect(updated.auditTrail.length).toBe(2);
            expect(updated.auditTrail[1].action).toBe("UPDATED");
        });

        it("should prevent non-owner from updating", async () => {
            const created = await service.createItem({
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "owner-id",
                childIds: ["child-1"],
                encryptedPayload: mockEncryptedPayload,
                ...signatureData
            });

            await expect(
                service.updateItem(created.id, { ...signatureData }, "attacker-id")
            ).rejects.toThrow("Unauthorized");
        });
    });

    describe("deleteItem", () => {
        it("should mark item as deleted", async () => {
            const created = await service.createItem({
                type: "NOTE",
                date: "2026-01-27",
                createdBy: "user-123",
                childIds: ["child-1"],
                encryptedPayload: mockEncryptedPayload,
                ...signatureData
            });

            await service.deleteItem(created.id, "user-123", signatureData, "User Name");

            const items = await service.getItemsByDate("2026-01-27");
            expect(items).toHaveLength(0);

            const inStorage = await repository.findById(created.id);
            expect(inStorage?.isDeleted).toBe(true);
        });
    });
});
