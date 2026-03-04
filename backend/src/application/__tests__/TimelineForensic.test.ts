import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { RealDateProvider } from "../../adapters/secondary/RealDateProvider";
import { RealUuidProvider } from "../../adapters/secondary/RealUuidProvider";
import type { CreateTimelineItemDto } from "../../core/domain/TimelineItem";
import type { ICryptoService } from "../../core/ports/ICryptoService";
import type { Model } from "mongoose";
import type { IFamily } from "../../models/Family";

class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
    async encryptRSA(plaintext: string, publicKey: string): Promise<string> {
        return `encrypted-${plaintext.substring(0, 10)}-with-${publicKey}`;
    }
}

describe("Timeline Forensic Integration", () => {
    let service: TimelineServiceImpl;
    let forensicIntentSave: ReturnType<typeof vi.fn>;
    let scheduleTask: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        const repository = new InMemoryTimelineRepository();

        const mockFamilyModel = {
            findById: vi.fn().mockResolvedValue({
                parentIds: ["mom-1", "dad-1"],
                parentPublicKeys: [
                    { parentId: "mom-1", role: "mom", rsaPublicKeyBase64: "mom-pub-key" },
                    { parentId: "dad-1", role: "dad", rsaPublicKeyBase64: "dad-pub-key" }
                ]
            })
        };

        forensicIntentSave = vi.fn().mockResolvedValue(undefined);
        const mockForensicIntentRepository = {
            save: forensicIntentSave
        };
        scheduleTask = vi.fn().mockResolvedValue({ id: "task-1" });
        const mockTaskManager = {
            schedule: scheduleTask
        };

        const mockChildRepository = {
            findById: vi.fn().mockResolvedValue({
                id: "child-1",
                familyId: "family1",
                momId: "mom-1",
                dadId: "dad-1"
            })
        };

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            new MockCryptoService(),
            mockFamilyModel as Model<IFamily>,
            mockChildRepository,
            mockForensicIntentRepository as any,
            mockTaskManager as any
        );
    });

    it("create triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            content: "Initial note",
            childIds: ["child-1"],
            childId: "child-1",
        } as unknown as CreateTimelineItemDto & { childId: string };

        await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        expect(forensicIntentSave).toHaveBeenCalledTimes(1);
        expect(scheduleTask).toHaveBeenCalledTimes(1);
    });

    it("update triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            content: "Initial note",
            childIds: ["child-1"],
            childId: "child-1",
        } as unknown as CreateTimelineItemDto & { childId: string };

        const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: false, content: "Updated note" } as any, "user-123", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(2);
    });

    it("delete triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            content: "Initial note",
            childIds: ["child-1"],
            childId: "child-1",
        } as unknown as CreateTimelineItemDto & { childId: string };

        const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.deleteItem(created.id, "user-123", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(2);
    });
});
