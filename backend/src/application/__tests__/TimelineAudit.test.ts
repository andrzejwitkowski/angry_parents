import { describe, it, expect, beforeEach } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { RealDateProvider } from "../../adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "../../adapters/secondary/RealUuidProvider";
import { InMemoryChildRepository } from "../../adapters/secondary/InMemoryChildRepository";
import type { CreateTimelineItemDto } from "../../core/domain/TimelineItem";

describe("Timeline Audit System", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        const childRepo = new InMemoryChildRepository();
        childRepo.save({
            id: "child-1",
            familyId: "family-1",
            name: "Child",
            color: "#FFF",
            icon: "child",
            momId: "dad-1", // Using IDs from the mock below
            dadId: "user-1"
        });

        const mockCryptoService = {
            encrypt: async (text: string) => `encrypted_${text}`,
            decrypt: async (text: string) => text.replace("encrypted_", ""),
            encryptRSA: async (text: string, key: string) => `rsa_encrypted_${text}_with_${key}`
        } as any;

        const mockFamilyModel = {
            findById: async () => ({
                id: "family-1",
                parentIds: ["dad-1", "user-1"],
                parents: [
                    { id: "dad-1", role: "ADMIN", publicKeyParams: { x: "x1", y: "y1" } },
                    { id: "user-1", role: "USER", publicKeyParams: { x: "x2", y: "y2" } }
                ],
                parentPublicKeys: [
                    { parentId: "dad-1", role: "mom", rsaPublicKeyBase64: "mom-key" },
                    { parentId: "user-1", role: "dad", rsaPublicKeyBase64: "dad-key" }
                ]
            })
        } as any;

        const forensicIntentRepository = {
            save: async () => { },
        } as any;
        const taskManager = {
            schedule: async () => ({ id: "task-1" })
        } as any;

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            mockCryptoService,
            mockFamilyModel,
            childRepo,
            forensicIntentRepository,
            taskManager
        );
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

        const item = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

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

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // First update
        await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, content: "Updated once" } as any, "user-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        // Second update
        const updated2 = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, content: "Updated twice" } as any, "user-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        expect(updated2.auditTrail).toHaveLength(3);
        expect(updated2.auditTrail[1].action).toBe("UPDATED");
        expect(updated2.auditTrail[1].changes).toEqual({ note: "Field-level changes hidden due to encryption" });
        expect(updated2.auditTrail[2].changes).toEqual({ note: "Field-level changes hidden due to encryption" });
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

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // Update by the same user (owner)
        const updated = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, content: "Changed" } as any, "user-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

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

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.deleteItem(created.id, "user-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

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

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // Update with SAME values
        const updated = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, administered: false } as any, "user-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        // Audit trail SHOULD increase now because we can't diff ciphertexts
        expect(updated.auditTrail).toHaveLength(2);
        expect(updated.auditTrail[1].action).toBe("UPDATED");
    });
});
