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
}

describe("Timeline Forensic Integration (E2EE)", () => {
    let service: TimelineServiceImpl;
    let forensicIntentSave: ReturnType<typeof vi.fn>;
    let scheduleTask: ReturnType<typeof vi.fn>;

    const mockEncryptedPayload = { "mom": "secret" };
    const signatureData = {
        signatureBase64: "mock-sig",
        timestamp: "2024-01-01T12:00:00.000Z",
        keyId: "key1"
    };

    beforeEach(() => {
        const repository = new InMemoryTimelineRepository();

        const mockFamilyModel = {
            findById: vi.fn().mockResolvedValue({
                parentIds: ["mom-1", "dad-1"],
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
        const dto: CreateTimelineItemDto & typeof signatureData = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childIds: ["child-1"],
            encryptedPayload: mockEncryptedPayload,
            ...signatureData
        };

        await service.createItem(dto);

        expect(forensicIntentSave).toHaveBeenCalledTimes(1);
        expect(scheduleTask).toHaveBeenCalledTimes(1);
    });

    it("update triggers forensic document creation", async () => {
        const dto: CreateTimelineItemDto & typeof signatureData = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childIds: ["child-1"],
            encryptedPayload: mockEncryptedPayload,
            ...signatureData
        };

        const created = await service.createItem(dto);
        await service.updateItem(created.id, {
            ...dto,
            encryptedPayload: { "mom": "updated" }
        }, "user-123", "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(2);
    });

    it("delete triggers forensic document creation", async () => {
        const dto: CreateTimelineItemDto & typeof signatureData = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childIds: ["child-1"],
            encryptedPayload: mockEncryptedPayload,
            ...signatureData
        };

        const created = await service.createItem(dto);
        await service.deleteItem(created.id, "user-123", signatureData, "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(2);
    });
});
