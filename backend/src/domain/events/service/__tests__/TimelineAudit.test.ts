import { describe, it, expect, beforeEach } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { RealDateProvider } from "../../../../shared/providers/RealDateProvider";
import { RealUuidProvider } from "../../../../shared/providers/RealUuidProvider";
import { InMemoryChildRepository } from "../../../../adapters/mongo/inmemory/family/InMemoryChildRepository";
import type { CreateTimelineItemDto } from "../../model/TimelineItem";
import type { PasskeyRepository } from "../../../auth/ports/PasskeyRepository";
import { TaskStatus, TaskType } from "../../../shared/ports/TaskScheduler";

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
        } as any);

        const mockCryptoService = {
            encrypt: async (text: string) => `encrypted_${text}`,
            decrypt: async (text: string) => text.replace("encrypted_", ""),
            encryptRSA: async (text: string, key: string) => `rsa_encrypted_${text}_with_${key}`
        } as any;

        const passkeyRepository: PasskeyRepository = {
            save: async () => { },
            findByUserId: async () => [{
                userId: "dad-1",
                webauthnUserId: "webauthn-dad-1",
                credentialID: new Uint8Array([107, 101, 121, 49]),
                credentialPublicKey: new Uint8Array([100, 101, 118]),
                counter: 0,
                createdAt: new Date(),
                name: "test-passkey"
            }],
            findByCredentialID: async () => null,
            countByUserId: async () => 1,
            updateCounter: async () => { }
        };

        const forensicIntentRepository = {
            save: async () => { },
            findById: async () => null,
            markProcessing: async () => true,
            markCompleted: async () => { },
            markRetry: async () => { }
        } as any;
        const taskManager = {
            registerHandler: async () => { },
            schedule: async (type: unknown, payload: unknown) => ({
                id: "task-1",
                type: type as TaskType,
                payload,
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
            }),
            start: async () => { },
            stop: async () => { }
        } as any;

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            mockCryptoService,
            childRepo,
            passkeyRepository,
            forensicIntentRepository,
            taskManager
        );
    });

    it("should create an item with initial audit trail", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "encrypted-hello" },
        } as any;

        const item = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        expect(item.auditTrail).toHaveLength(1);
        expect(item.auditTrail[0].action).toBe("CREATED");
        expect(item.auditTrail[0].userId).toBe("dad-1");
        expect(item.auditTrail[0].userName).toBe("Alice");
        expect(item.isDeleted).toBe(false);
    });

    it("should initialize proof version metadata for a created encrypted item", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "encrypted-hello" },
        } as any;

        const item = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        expect((item as any).eventVersion).toBe(1);
        expect((item as any).versionHistory).toHaveLength(1);
        expect((item as any).versionHistory[0]).toMatchObject({
            version: 1,
            proofHistory: [],
            snapshot: {
                id: item.id,
                type: "NOTE",
                date: "2026-02-03",
                createdAt: item.createdAt,
                createdBy: "dad-1",
                createdByName: "Alice",
                encryption: "ENCRYPTED",
                encryptedPayload: { "dad-1": "encrypted-hello" },
                isDeleted: false,
                childIds: ["child-1"],
            }
        });
    });

    it("should track multiple updates in the audit trail", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "initial-encrypted" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // First update
        await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, encryptedPayload: { "dad-1": "updated-encrypted-1" } } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        // Second update
        const updated2 = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, encryptedPayload: { "dad-1": "updated-encrypted-2" } } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        expect(updated2.auditTrail).toHaveLength(3);
        expect(updated2.auditTrail[1].action).toBe("UPDATED");
        expect(updated2.auditTrail[1].changes).toEqual({ note: "Field-level changes hidden due to encryption" });
        expect(updated2.auditTrail[2].changes).toEqual({ note: "Field-level changes hidden due to encryption" });
    });

    it("should preserve prior proof history and append a new version snapshot on update", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "initial-encrypted" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        const anchoredProof = {
            version: 1,
            hash: "hash-v1",
            txHash: "0xabc",
            blockNumber: "42",
            anchoredAt: "2026-02-03T00:00:00.000Z"
        };

        await repository.update(created.id, {
            versionHistory: [{
                ...(created as any).versionHistory?.[0],
                proofHistory: [anchoredProof]
            }]
        } as any);

        const updated = await service.updateItem(created.id, {
            ...dto,
            id: created.id,
            createdAt: created.createdAt,
            auditTrail: created.auditTrail,
            isDeleted: created.isDeleted,
            encryptedPayload: { "dad-1": "updated-encrypted" }
        } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        expect((updated as any).eventVersion).toBe(2);
        expect((updated as any).versionHistory).toHaveLength(2);
        expect((updated as any).versionHistory[0].proofHistory).toEqual([anchoredProof]);
        expect((updated as any).versionHistory[0].snapshot.encryptedPayload).toEqual({ "dad-1": "initial-encrypted" });
        expect((updated as any).versionHistory[1]).toMatchObject({
            version: 2,
            proofHistory: [],
            snapshot: {
                encryptedPayload: { "dad-1": "updated-encrypted" }
            }
        });
    });

    it("should bootstrap legacy version 1 before assigning version 2 on first update", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-02-05",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "legacy-v1" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await repository.update(created.id, {
            eventVersion: undefined as any,
            versionHistory: []
        } as any);

        const updated = await service.updateItem(created.id, {
            ...dto,
            id: created.id,
            createdAt: created.createdAt,
            auditTrail: created.auditTrail,
            isDeleted: false,
            encryptedPayload: { "dad-1": "legacy-v2" }
        } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        expect((updated as any).eventVersion).toBe(2);
        expect((updated as any).versionHistory).toHaveLength(2);
        expect((updated as any).versionHistory[0].version).toBe(1);
        expect((updated as any).versionHistory[0].snapshot.encryptedPayload).toEqual({ "dad-1": "legacy-v1" });
        expect((updated as any).versionHistory[1].version).toBe(2);
        expect((updated as any).versionHistory[1].snapshot.encryptedPayload).toEqual({ "dad-1": "legacy-v2" });
    });

    it("should track who made the update", async () => {
        const dto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "initial-encrypted" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // Update by the same user (owner)
        const updated = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, encryptedPayload: { "dad-1": "changed-encrypted" } } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        expect(updated.auditTrail[1].userId).toBe("dad-1");
        expect(updated.auditTrail[1].userName).toBe("Alice");
    });

    it("should perform soft delete and record it in audit trail", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "delete-me-encrypted" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await service.deleteItem(created.id, "dad-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        // Verify it's gone from normal queries
        const items = await service.getItemsByDate("2026-02-03");
        expect(items).toHaveLength(0);

        // Verify it still exists in repository with audit trail
        const inRepo = await repository.findByIdIncludingDeleted(created.id);
        expect(inRepo).not.toBeNull();
        expect(inRepo?.isDeleted).toBe(true);
        expect((inRepo as any)?.eventVersion).toBe(2);
        expect((inRepo as any)?.versionHistory).toHaveLength(2);
        expect((inRepo as any)?.versionHistory[1]).toMatchObject({
            version: 2,
            proofHistory: [],
            snapshot: {
                isDeleted: true
            }
        });
        expect(inRepo?.auditTrail).toHaveLength(2);
        expect(inRepo?.auditTrail[1].action).toBe("DELETED");
        expect(inRepo?.auditTrail[1].userName).toBe("Alice");
    });

    it("should bootstrap legacy version 1 before assigning version 2 on first delete", async () => {
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-06",
            createdBy: "dad-1",
            createdByName: "Alice",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "legacy-delete-v1" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);
        await repository.update(created.id, {
            eventVersion: undefined as any,
            versionHistory: []
        } as any);

        await service.deleteItem(created.id, "dad-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        const deleted = await repository.findByIdIncludingDeleted(created.id);
        expect((deleted as any)?.eventVersion).toBe(2);
        expect((deleted as any)?.versionHistory).toHaveLength(2);
        expect((deleted as any)?.versionHistory[0].version).toBe(1);
        expect((deleted as any)?.versionHistory[0].snapshot.encryptedPayload).toEqual({ "dad-1": "legacy-delete-v1" });
        expect((deleted as any)?.versionHistory[1].version).toBe(2);
        expect((deleted as any)?.versionHistory[1].snapshot.isDeleted).toBe(true);
    });

    it("should only track actual changes in update", async () => {
        const dto: CreateTimelineItemDto = {
            type: "MEDS",
            date: "2026-02-03",
            createdBy: "dad-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "dad-1": "encrypted-meds" },
        } as any;

        const created = await service.createItem({ ...dto, childId: "child-1", signatureBase64: "mock-sig", timestamp: "2024-01-01T12:00:00.000Z", keyId: "key1" } as any);

        // Update with SAME values
        const updated = await service.updateItem(created.id, { ...dto, id: created.id, createdAt: created.createdAt, auditTrail: created.auditTrail, isDeleted: created.isDeleted, encryptedPayload: { "dad-1": "encrypted-meds" } } as any, "dad-1", "child-1", {
            signatureBase64: "mock-sig",
            timestamp: "2024-01-01T12:00:00.000Z",
            keyId: "key1"
        }, "Alice");

        // Audit trail SHOULD increase now because we can't diff ciphertexts
        expect(updated.auditTrail).toHaveLength(2);
        expect(updated.auditTrail[1].action).toBe("UPDATED");
    });
});
