import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { RealDateProvider } from "../../../../shared/providers/RealDateProvider";
import { RealUuidProvider } from "../../../../shared/providers/RealUuidProvider";
import type { CreateTimelineItemDto } from "../../model/TimelineItem";
import type { ICryptoService } from "../../../shared/ports/ICryptoService";
import type { PasskeyRepository } from "../../../auth/ports/PasskeyRepository";
import type { ChildRepository } from "../../../family/ports/ChildRepository";
import { TaskStatus, TaskType } from "../../../shared/ports/TaskScheduler";
import type { ForensicIntentRepository } from "../../../forensic/ports/ForensicIntentRepository";
import type { ITaskManager } from "../../../shared/ports/TaskScheduler";

class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
    async encryptRSA(plaintext: string, publicKey: string): Promise<string> {
        return `encrypted-${plaintext.substring(0, 10)}-with-${publicKey}`;
    }
}

describe("Timeline Forensic Integration", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;
    let forensicIntentSave: ReturnType<typeof vi.fn>;
    let scheduleTask: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        forensicIntentSave = vi.fn().mockResolvedValue(undefined);
        const mockForensicIntentRepository: ForensicIntentRepository = {
            save: forensicIntentSave as unknown as ForensicIntentRepository["save"],
            findById: vi.fn().mockResolvedValue(null),
            markProcessing: vi.fn().mockResolvedValue(true),
            markCompleted: vi.fn().mockResolvedValue(undefined),
            markRetry: vi.fn().mockResolvedValue(undefined)
        };
        scheduleTask = vi.fn().mockResolvedValue({
            id: "task-1",
            type: TaskType.PROCESS_FORENSIC_INTENT,
            payload: { intentId: "intent-1" },
            payloadHash: "hash",
            status: TaskStatus.NEW,
            scheduledAt: new Date(),
            retryCount: 0,
            retryPolicy: { maxRetries: 3, initialDelayMinutes: 1 },
            workerId: null,
            lockedUntil: null,
            processingStartedAt: null,
            timeoutMinutes: 10,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const mockTaskManager: ITaskManager = {
            registerHandler: vi.fn(),
            schedule: scheduleTask as unknown as ITaskManager["schedule"],
            start: vi.fn(),
            stop: vi.fn()
        };

        const mockChildRepository: ChildRepository = {
            save: vi.fn().mockImplementation(async (child) => child),
            findAllByFamilyId: vi.fn().mockResolvedValue([]),
            findById: vi.fn().mockResolvedValue({
                id: "child-1",
                familyId: "family1",
                momId: "mom-1",
                dadId: "dad-1"
            }),
            delete: vi.fn().mockResolvedValue(undefined)
        };

        const mockPasskeyRepository: PasskeyRepository = {
            save: vi.fn().mockResolvedValue(undefined),
            findByUserId: vi.fn().mockResolvedValue([
                {
                    userId: "user-123",
                    webauthnUserId: "webauthn-user-123",
                    credentialID: new Uint8Array([107, 101, 121, 49]),
                    credentialPublicKey: new Uint8Array([100, 101, 118]),
                    counter: 0,
                    createdAt: new Date(),
                    name: "test-passkey"
                }
            ]),
            findByCredentialID: vi.fn().mockResolvedValue(null),
            countByUserId: vi.fn().mockResolvedValue(1),
            updateCounter: vi.fn().mockResolvedValue(undefined)
        };

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            new MockCryptoService(),
            mockChildRepository,
            mockPasskeyRepository,
            mockForensicIntentRepository,
            mockTaskManager
        );
    });

    it("create triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-123": "encrypted-note" },
        } as any;

        await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        expect(forensicIntentSave).toHaveBeenCalledTimes(1);
        expect(scheduleTask).toHaveBeenCalledTimes(2);
    });

    it("update triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-123": "encrypted-note" },
        } as any;

        const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: false, content: "Updated note" } as any, "user-123", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(4);
    });

    it("update forensic intent keeps proof history and adds a new versioned snapshot", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-123": "encrypted-note" },
        } as any;

        const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        const anchoredProof = {
            version: 1,
            hash: "hash-v1",
            txHash: "0xabc",
            blockNumber: "42",
            anchoredAt: "2026-01-27T00:00:00.000Z"
        };

        await repository.update(created.id, {
            versionHistory: [{
                ...(created as any).versionHistory?.[0],
                proofHistory: [anchoredProof]
            }]
        } as any);

        await service.updateItem(created.id, {
            ...dto,
            id: created.id,
            createdAt: created.createdAt,
            auditTrail: created.auditTrail,
            isDeleted: false,
            encryptedPayload: { "user-123": "encrypted-note-v2" }
        } as any, "user-123", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "User");

        const updatedTimelineItem = forensicIntentSave.mock.calls[1][0].timelineItem;

        expect(updatedTimelineItem.eventVersion).toBe(2);
        expect(updatedTimelineItem.versionHistory).toHaveLength(2);
        expect(updatedTimelineItem.versionHistory[0].proofHistory).toEqual([anchoredProof]);
        expect(updatedTimelineItem.versionHistory[1]).toMatchObject({
            version: 2,
            proofHistory: [],
            snapshot: {
                encryptedPayload: { "user-123": "encrypted-note-v2" }
            }
        });
    });

    it("delete triggers forensic document creation", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-01-27",
            createdBy: "user-123",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-123": "encrypted-note" },
        } as any;

        const created = await service.createItem({ ...dto, signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.deleteItem(created.id, "user-123", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "User");

        expect(forensicIntentSave).toHaveBeenCalledTimes(2);
        expect(scheduleTask).toHaveBeenCalledTimes(4);
    });
});
