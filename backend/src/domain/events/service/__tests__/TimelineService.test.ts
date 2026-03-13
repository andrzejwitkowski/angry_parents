import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { InMemoryTimelineMutationRequestRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineMutationRequestRepository";
import { InMemoryTaskOutboxRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTaskOutboxRepository";
import { RealDateProvider } from "../../../../shared/providers/RealDateProvider";
import { RealUuidProvider } from "../../../../shared/providers/RealUuidProvider";
import type { CreateTimelineItemDto } from "../../model/TimelineItem";
import type { ICryptoService } from "../../../shared/ports/ICryptoService";
import type { PasskeyRepository } from "../../../auth/ports/PasskeyRepository";
import type { ChildRepository } from "../../../family/ports/ChildRepository";
import type { ForensicIntentRepository } from "../../../forensic/ports/ForensicIntentRepository";
import type { ITaskManager } from "../../../shared/ports/TaskScheduler";
import { TaskType } from "../../../shared/ports/TaskScheduler";
import type { TimelineMutationRequestRecord, TimelineMutationRequestRepository } from "../../ports/TimelineMutationRequestRepository";
import { calculatePayloadHash } from "../../../../scheduler/utils/crypto";
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
    let mockChildRepository: ChildRepository;
    let mockPasskeyRepository: PasskeyRepository;
    let mockForensicIntentRepository: ForensicIntentRepository;
    let mockTaskManager: ITaskManager;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        mockChildRepository = {
            save: vi.fn().mockImplementation(async (child) => child),
            findAllByFamilyId: vi.fn().mockResolvedValue([]),
            findById: vi.fn().mockImplementation((id: string) => Promise.resolve({
                id,
                familyId: 'family1',
                momId: 'mom-1',
                dadId: 'dad-1'
            })),
            delete: vi.fn().mockResolvedValue(undefined)
        };

        mockPasskeyRepository = {
            save: vi.fn().mockResolvedValue(undefined),
            findByUserId: vi.fn().mockImplementation(async (userId: string) => [
                {
                    userId,
                    webauthnUserId: `webauthn-${userId}`,
                    credentialID: new Uint8Array([107, 101, 121, 49]),
                    credentialPublicKey: new Uint8Array([100, 101, 118]),
                    counter: 0,
                    createdAt: new Date(),
                    name: `test-passkey-${userId}`
                }
            ]),
            findByCredentialID: vi.fn().mockResolvedValue(null),
            countByUserId: vi.fn().mockResolvedValue(1),
            updateCounter: vi.fn().mockResolvedValue(undefined)
        };

        mockForensicIntentRepository = {
            save: vi.fn().mockResolvedValue(undefined),
            findById: vi.fn().mockResolvedValue(null),
            markProcessing: vi.fn().mockResolvedValue(true),
            markCompleted: vi.fn().mockResolvedValue(undefined),
            markRetry: vi.fn().mockResolvedValue(undefined)
        };
        mockTaskManager = {
            registerHandler: vi.fn(),
            schedule: vi.fn().mockResolvedValue({ id: "task-1" }),
            start: vi.fn(),
            stop: vi.fn()
        };

        service = new TimelineServiceImpl(
            repository,
            new RealDateProvider(),
            new RealUuidProvider(),
            new MockCryptoService(),
            mockChildRepository,
            mockPasskeyRepository,
            mockForensicIntentRepository,
            mockTaskManager,
        );
    });

    const mockSignature = {
        signatureBase64: "mock-sig",
        timestamp: "2024-01-01T12:00:00.000Z",
        keyId: "key1"
    };

    describe("createItem", () => {
        it("should create a valid medical visit item (encrypted)", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: {
                    "mom-1": "encrypted-content-for-mom",
                    "dad-1": "encrypted-content-for-dad"
                }
            };

            const item = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "Dr. Smith"
            } as any);

            expect(item.id).toBeDefined();
            expect(item.createdAt).toBeDefined();
            expect(item.type).toBe("MEDICAL_VISIT");
            expect(item.encryption).toBe("ENCRYPTED");
            expect(item.encryptedPayload["mom-1"]).toBe("encrypted-content-for-mom");
            expect(mockTaskManager.schedule).toHaveBeenCalledWith(
                TaskType.PUBLISH_EVENT_PROOF,
                { itemId: item.id, version: 1 },
                { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
            );
        });

        it("passes the created version number to async proof publishing", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            const item = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(mockTaskManager.schedule).toHaveBeenCalledWith(
                TaskType.PUBLISH_EVENT_PROOF,
                { itemId: item.id, version: 1 },
                { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
            );
        });

        it("returns the same created item when createItem is replayed with the same idempotencyKey", async () => {
            const replaySafeService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new InMemoryTimelineMutationRequestRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            const first = await replaySafeService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-create-note-1",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            const second = await replaySafeService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-create-note-1",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(second.id).toBe(first.id);

            const items = await repository.findByDate("2026-01-27");
            expect(items).toHaveLength(1);
        });

        it("rejects replay when the same idempotencyKey is reused with a different payload", async () => {
            const replaySafeService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new InMemoryTimelineMutationRequestRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            await replaySafeService.createItem({
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload-a", "dad-1": "payload-a" },
                ...mockSignature,
                idempotencyKey: "idem-create-note-mismatch",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            await expect(replaySafeService.createItem({
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload-b", "dad-1": "payload-b" },
                ...mockSignature,
                idempotencyKey: "idem-create-note-mismatch",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any)).rejects.toThrow("idempotencyKey reuse with different payload");
        });

        it("returns the already-created item when mutation request persistence loses a duplicate-key race", async () => {
            const replayedItemId = "33333333-3333-4333-8333-333333333333";

            await repository.save({
                id: replayedItemId,
                type: "NOTE",
                date: "2026-01-27",
                createdAt: "2026-01-27T10:00:00.000Z",
                createdBy: "user-123",
                createdByName: "Tester",
                auditTrail: [],
                isDeleted: false,
                childIds: ["child-1"],
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                eventVersion: 1,
                versionHistory: [],
            } as any);

            class DuplicateKeyOnSaveRepository implements TimelineMutationRequestRepository {
                private firstLookup = true;

                async save(_record: TimelineMutationRequestRecord): Promise<void> {
                    const error = new Error("E11000 duplicate key error collection: timelineMutationRequests");
                    (error as Error & { code?: number }).code = 11000;
                    throw error;
                }

                async update(_record: TimelineMutationRequestRecord): Promise<void> {
                    return undefined;
                }

                async findByIdempotencyKey(idempotencyKey: string): Promise<TimelineMutationRequestRecord | null> {
                    if (this.firstLookup) {
                        this.firstLookup = false;
                        return null;
                    }
                    return {
                        idempotencyKey,
                        operation: "CREATE_TIMELINE_ITEM",
                        status: "COMPLETED",
                        requestHash: calculatePayloadHash({
                            type: "NOTE",
                            date: "2026-01-27",
                            childId: "child-1",
                            encryption: "ENCRYPTED",
                            encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                            signatureBase64: mockSignature.signatureBase64,
                            timestamp: mockSignature.timestamp,
                            keyId: mockSignature.keyId,
                            createdBy: "user-123",
                        }),
                        timelineItemId: replayedItemId,
                    };
                }
            }

            const raceSafeService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new DuplicateKeyOnSaveRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            const created = await raceSafeService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-race-1",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(created.id).toBe(replayedItemId);
            const items = await repository.findByDate("2026-01-27");
            expect(items).toHaveLength(1);
        });

        it("does not leave behind a duplicate timeline item when idempotent create loses a race without transactions", async () => {
            const matchingRequestHash = calculatePayloadHash({
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                signatureBase64: mockSignature.signatureBase64,
                timestamp: mockSignature.timestamp,
                keyId: mockSignature.keyId,
                createdBy: "user-123",
            });

            class RacingMutationRepository implements TimelineMutationRequestRepository {
                private firstLookup = true;

                async save(_record: TimelineMutationRequestRecord): Promise<void> {
                    const error = new Error("E11000 duplicate key error collection: timelineMutationRequests");
                    (error as Error & { code?: number }).code = 11000;
                    throw error;
                }

                async update(_record: TimelineMutationRequestRecord): Promise<void> {
                    return undefined;
                }

                async findByIdempotencyKey(): Promise<TimelineMutationRequestRecord | null> {
                    if (this.firstLookup) {
                        this.firstLookup = false;
                        return null;
                    }

                    return {
                        idempotencyKey: "idem-race-no-dup",
                        operation: "CREATE_TIMELINE_ITEM",
                        status: "COMPLETED",
                        requestHash: matchingRequestHash,
                        timelineItemId: "22222222-2222-4222-8222-222222222222",
                    };
                }
            }

            class StableUuidProvider extends RealUuidProvider {
                override generate(): string {
                    return "11111111-1111-4111-8111-111111111111";
                }
            }

            await repository.save({
                id: "22222222-2222-4222-8222-222222222222",
                type: "NOTE",
                date: "2026-01-27",
                createdAt: "2026-01-27T10:00:00.000Z",
                createdBy: "user-123",
                createdByName: "Tester",
                auditTrail: [],
                isDeleted: false,
                childIds: ["child-1"],
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                eventVersion: 1,
                versionHistory: [],
            } as any);

            const raceSafeService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new StableUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new RacingMutationRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            const created = await raceSafeService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-race-no-dup",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(created.id).toBe("22222222-2222-4222-8222-222222222222");
            const items = await repository.findByDate("2026-01-27");
            expect(items).toHaveLength(1);
            expect(items[0].id).toBe("22222222-2222-4222-8222-222222222222");
        });

        it("recovers when the first idempotent create stores an in-progress claim but item persistence fails", async () => {
            class StableUuidProvider extends RealUuidProvider {
                override generate(): string {
                    return "44444444-4444-4444-8444-444444444444";
                }
            }

            class FlakySaveRepository extends InMemoryTimelineRepository {
                private hasFailed = false;

                override async save(item: any, session?: unknown) {
                    if (!this.hasFailed) {
                        this.hasFailed = true;
                        throw new Error("mongo write interrupted");
                    }

                    return super.save(item, session);
                }
            }

            const mutationRepository = new InMemoryTimelineMutationRequestRepository();
            const flakyRepository = new FlakySaveRepository();
            const resilientService = new TimelineServiceImpl(
                flakyRepository,
                new RealDateProvider(),
                new StableUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                mutationRepository,
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            await expect(resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-recover-in-progress",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any)).rejects.toThrow("mongo write interrupted");

            const claimedRequest = await mutationRepository.findByIdempotencyKey("idem-recover-in-progress");
            expect(claimedRequest).toMatchObject({
                idempotencyKey: "idem-recover-in-progress",
                status: "IN_PROGRESS",
                timelineItemId: "44444444-4444-4444-8444-444444444444",
            });

            const created = await resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-recover-in-progress",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(created.id).toBe("44444444-4444-4444-8444-444444444444");

            const completedRequest = await mutationRepository.findByIdempotencyKey("idem-recover-in-progress");
            expect(completedRequest).toMatchObject({
                idempotencyKey: "idem-recover-in-progress",
                status: "COMPLETED",
                timelineItemId: "44444444-4444-4444-8444-444444444444",
            });

            const items = await flakyRepository.findByDate("2026-01-27");
            expect(items).toHaveLength(1);
            expect(items[0].id).toBe("44444444-4444-4444-8444-444444444444");
        });

        it("repairs missing async work when retry sees an in-progress idempotent record with an existing item", async () => {
            class RecordingMutationRepository extends InMemoryTimelineMutationRequestRepository {
                async seed(record: TimelineMutationRequestRecord): Promise<void> {
                    await this.update(record);
                }
            }

            const mutationRepository = new RecordingMutationRepository();
            const outboxRepository = new InMemoryTaskOutboxRepository();
            const repairingService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                mutationRepository,
                outboxRepository,
            );

            const requestHash = calculatePayloadHash({
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                signatureBase64: mockSignature.signatureBase64,
                timestamp: mockSignature.timestamp,
                keyId: mockSignature.keyId,
                createdBy: "user-123",
            });

            await repository.save({
                id: "55555555-5555-4555-8555-555555555555",
                type: "NOTE",
                date: "2026-01-27",
                createdAt: "2026-01-27T10:00:00.000Z",
                createdBy: "user-123",
                createdByName: "Tester",
                auditTrail: [],
                isDeleted: false,
                childIds: ["child-1"],
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                eventVersion: 1,
                versionHistory: [],
            } as any);

            await mutationRepository.seed({
                idempotencyKey: "idem-repair-async-work",
                operation: "CREATE_TIMELINE_ITEM",
                status: "IN_PROGRESS",
                timelineItemId: "55555555-5555-4555-8555-555555555555",
                requestHash,
            });

            const repaired = await repairingService.createItem({
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" },
                ...mockSignature,
                idempotencyKey: "idem-repair-async-work",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            expect(repaired.id).toBe("55555555-5555-4555-8555-555555555555");

            const mutation = await mutationRepository.findByIdempotencyKey("idem-repair-async-work");
            expect(mutation?.status).toBe("COMPLETED");

            const outboxEntries = await outboxRepository.getAll();
            expect(outboxEntries.map((entry) => entry.taskType)).toEqual([
                TaskType.PROCESS_FORENSIC_INTENT,
                TaskType.PUBLISH_EVENT_PROOF,
            ]);
        });

        it("keeps idempotent create replay repairable when outbox persistence fails after item save", async () => {
            class FlakyOutboxRepository extends InMemoryTaskOutboxRepository {
                private shouldFail = true;

                override async append(entry: any): Promise<void> {
                    if (this.shouldFail) {
                        this.shouldFail = false;
                        throw new Error("outbox unavailable");
                    }

                    return super.append(entry);
                }
            }

            const mutationRepository = new InMemoryTimelineMutationRequestRepository();
            const outboxRepository = new FlakyOutboxRepository();
            const resilientService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                mutationRepository,
                outboxRepository,
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            await expect(resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-outbox-repair",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any)).rejects.toThrow("outbox unavailable");

            const pendingRequest = await mutationRepository.findByIdempotencyKey("idem-outbox-repair");
            expect(pendingRequest).toMatchObject({
                idempotencyKey: "idem-outbox-repair",
                status: "IN_PROGRESS",
            });

            const repaired = await resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-outbox-repair",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            const completedRequest = await mutationRepository.findByIdempotencyKey("idem-outbox-repair");
            expect(completedRequest).toMatchObject({
                idempotencyKey: "idem-outbox-repair",
                status: "COMPLETED",
                timelineItemId: repaired.id,
            });

            const outboxEntries = await outboxRepository.getAll();
            expect(outboxEntries.map((entry) => entry.taskType)).toEqual([
                TaskType.PROCESS_FORENSIC_INTENT,
                TaskType.PUBLISH_EVENT_PROOF,
            ]);
        });

        it("does not duplicate async work when the final idempotency completion update fails once", async () => {
            class CompletionUpdateFailsOnceRepository extends InMemoryTimelineMutationRequestRepository {
                private failedCompletionUpdate = false;

                override async update(record: TimelineMutationRequestRecord): Promise<void> {
                    if (record.status === "COMPLETED" && !this.failedCompletionUpdate) {
                        this.failedCompletionUpdate = true;
                        throw new Error("mutation completion update failed");
                    }

                    return super.update(record);
                }
            }

            class RecordingForensicIntentRepository implements ForensicIntentRepository {
                private intents = new Map<string, any>();

                save = vi.fn(async (intent: any) => {
                    this.intents.set(intent.id, intent);
                });
                findById = vi.fn(async (id: string) => this.intents.get(id) ?? null);
                markProcessing = vi.fn(async () => true);
                markCompleted = vi.fn(async () => undefined);
                markRetry = vi.fn(async () => undefined);

                getIds(): string[] {
                    return [...this.intents.keys()];
                }
            }

            const mutationRepository = new CompletionUpdateFailsOnceRepository();
            const outboxRepository = new InMemoryTaskOutboxRepository();
            const forensicIntentRepository = new RecordingForensicIntentRepository();
            const resilientService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                forensicIntentRepository,
                mockTaskManager,
                mutationRepository,
                outboxRepository,
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "payload", "dad-1": "payload" }
            };

            await expect(resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-completion-update-retry",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any)).rejects.toThrow("mutation completion update failed");

            const repaired = await resilientService.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-completion-update-retry",
                createdBy: "user-123",
                createdByName: "Tester"
            } as any);

            const completedRequest = await mutationRepository.findByIdempotencyKey("idem-completion-update-retry");
            expect(completedRequest).toMatchObject({
                idempotencyKey: "idem-completion-update-retry",
                status: "COMPLETED",
                timelineItemId: repaired.id,
            });

            expect(forensicIntentRepository.getIds()).toEqual([
                `timeline-create:${repaired.id}:v1`,
            ]);

            const outboxEntries = await outboxRepository.getAll();
            expect(outboxEntries.map((entry) => [entry.taskType, entry.payloadHash])).toHaveLength(2);
            expect(outboxEntries.map((entry) => entry.taskType)).toEqual([
                TaskType.PROCESS_FORENSIC_INTENT,
                TaskType.PUBLISH_EVENT_PROOF,
            ]);
        });

        it("should create a medication item", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDS",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: {
                    "mom-1": "encrypted-meds-mom",
                    "dad-1": "encrypted-meds-dad"
                }
            };

            const item = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            expect(item.type).toBe("MEDS");
            expect(item.encryption).toBe("ENCRYPTED");
            expect(item.encryptedPayload).toBeDefined();
        });

        it("should reject handover with past date", async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const pastDate = yesterday.toISOString().split("T")[0];

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "HANDOVER",
                date: pastDate,
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "..." }
            };

            await expect(service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any)).rejects.toThrow(
                "Handover date cannot be in the past"
            );
        });

        it("should accept handover with today's date", async () => {
            const today = new Date().toISOString().split("T")[0];

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "HANDOVER",
                date: today,
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "...", "dad-1": "..." }
            };

            const item = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);
            expect(item.type).toBe("HANDOVER");
        });

        it("should reject creation with PLAINTEXT encryption (strict E2EE)", async () => {
            const dto = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "PLAINTEXT",
                content: "Unauthorized plaintext"
            } as any;

            await expect(service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any)).rejects.toThrow("PLAINTEXT encryption is not allowed. All items must be ENCRYPTED client-side.");
        });

        it("should create an incident with severity", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "INCIDENT",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "...", "dad-1": "..." }
            };

            const item = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);
            expect(item.type).toBe("INCIDENT");
            expect(item.encryptedPayload).toBeDefined();
        });
    });

    describe("getItemsByDate", () => {
        it("should return items sorted by creation time (newest first)", async () => {
            const dto1: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "first-note" }
            };

            const dto2: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "second-note" }
            };

            await service.createItem({
                ...dto1,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);
            await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
            const item2 = await service.createItem({
                ...dto2,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

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
        it("does not direct-schedule proof publication for updates when outbox is enabled", async () => {
            const serviceWithOutbox = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new InMemoryTimelineMutationRequestRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDS",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v1", "dad-1": "v1" }
            };

            const created = await serviceWithOutbox.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-update-outbox",
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            (mockTaskManager.schedule as any).mockClear();

            const updatedEncrypted = {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v2", "dad-1": "v2" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            await serviceWithOutbox.updateItem(created.id, updatedEncrypted, "user-123", "child-1", mockSignature, "user-123-name");

            expect(mockTaskManager.schedule).not.toHaveBeenCalledWith(
                TaskType.PUBLISH_EVENT_PROOF,
                expect.anything(),
                expect.anything()
            );
        });

        it("should update item with new client-side ciphertext", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDS",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v1", "dad-1": "v1" }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const updatedEncrypted = {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v2", "dad-1": "v2" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            const updated = await service.updateItem(created.id, updatedEncrypted, "user-123", "child-1", mockSignature, "user-123-name");

            expect(updated.encryptedPayload!["mom-1"]).toBe("v2");
            expect(updated.auditTrail.length).toBe(2);
            expect(updated.auditTrail[1].action).toBe("UPDATED");
        });

        it("should throw error when updating non-existent item", async () => {
            await expect(
                service.updateItem("non-existent-id", {} as any, "user-123", "child-1", mockSignature, "user-123-name")
            ).rejects.toThrow("Timeline item with id non-existent-id not found");
        });

        it("should throw error when non-owner tries to update", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "owner-id": "secret-note" }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "owner-id",
                createdByName: "owner-name"
            } as any);

            await expect(
                service.updateItem(created.id, { ...dto, encryption: "ENCRYPTED", encryptedPayload: { "owner-id": "Hacked" } } as any, "other-id", "child-1", mockSignature, "other-name")
            ).rejects.toThrow("Unauthorized: You can only modify your own items");
        });

        it("should successfully update an item with non-ISO createdAt (legacy data)", async () => {
            const legacyDate = "Thu Mar 05 2026 10:35:40 GMT+0100 (Central European Standard Time)";
            const id = "825b965e-75ba-45bb-846a-0aa327e3fced"; // Valid UUID

            // Manually insert a "corrupted" item into the repository
            const item = {
                id,
                type: "NOTE",
                date: "2026-03-09",
                content: "Legacy content",
                createdBy: "user-123",
                createdByName: "dad",
                createdAt: legacyDate,
                childIds: ["child-1"],
                auditTrail: [],
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "some-payload" },
                isDeleted: false
            } as any;

            await repository.save(item);

            const updateDto = {
                type: "NOTE",
                date: "2026-03-09",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "updated-content" },
                childId: "child-1"
            } as any;

            // This should NOT throw ZodError because we sanitize createdAt
            const updated = await service.updateItem(id, updateDto, "user-123", "child-1", {
                ...mockSignature,
                timestamp: new Date().toISOString()
            }, "dad");

            expect(updated).toBeDefined();
            const saved = await repository.findById(id);
            // Should be converted to ISO format
            expect(saved?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(saved?.createdAt).toContain('Z');
        });

        it("should reject handover update with past date", async () => {
            const today = new Date().toISOString().split("T")[0];
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "HANDOVER",
                date: today,
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "..." }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const pastDate = yesterday.toISOString().split("T")[0];

            const updatedEncrypted = {
                ...dto,
                id: created.id,
                date: pastDate,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "some-ciphertext" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            await expect(service.updateItem(created.id, updatedEncrypted, "user-123", "child-1", mockSignature, "user-123-name")).rejects.toThrow("Handover date cannot be in the past");
        });


        it("should accept handover update with valid date", async () => {
            const today = new Date().toISOString().split("T")[0];
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "HANDOVER",
                date: today,
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "..." }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const updatedEncrypted = {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "updated-payload" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            const updated = await service.updateItem(created.id, updatedEncrypted, "user-123", "child-1", mockSignature, "user-123-name");

            expect(updated).toBeDefined();
            expect(updated.type).toBe("HANDOVER");
        });

        it("should accept medical visit update with valid diagnosis", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "MEDICAL_VISIT",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "..." }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const updatedEncrypted = {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "updated-payload" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            const updated = await service.updateItem(created.id, updatedEncrypted, "user-123", "child-1", mockSignature, "user-123-name");

            expect(updated).toBeDefined();
            expect(updated.type).toBe("MEDICAL_VISIT");
        });


        it("should respect client-provided ciphertext during update (not re-encrypting)", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "Original" }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const clientUpdate = {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "client-ciphertext-mom", "dad-1": "client-ciphertext-dad" }
            } as any;

            const updated = await service.updateItem(created.id, clientUpdate, "user-123", "child-1", mockSignature, "user-123");

            // Should respect client ciphertext
            expect(updated.encryptedPayload).toBeDefined();
            expect(updated.encryptedPayload!["mom-1"]).toBe("client-ciphertext-mom");
            expect(updated.encryptedPayload!["dad-1"]).toBe("client-ciphertext-dad");
        });

        it("should still reject handover update with past date even if payload is ENCRYPTED", async () => {
            const today = new Date().toISOString().split("T")[0];
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "HANDOVER",
                date: today,
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "..." }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const pastDate = yesterday.toISOString().split("T")[0];

            const encryptedUpdate = {
                ...dto,
                id: created.id,
                date: pastDate,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "some-ciphertext" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any;

            await expect(service.updateItem(created.id, encryptedUpdate, "user-123", "child-1", mockSignature, "user-123-name")).rejects.toThrow("Handover date cannot be in the past");
        });

        it("writes durable outbox entries for forensic processing and proof publish on update", async () => {
            const outboxRepository = new InMemoryTaskOutboxRepository();
            const outboxBackedService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                undefined,
                outboxRepository,
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v1", "dad-1": "v1" }
            };

            const created = await outboxBackedService.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const baselineEntries = await outboxRepository.getAll();

            await outboxBackedService.updateItem(created.id, {
                ...dto,
                id: created.id,
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v2", "dad-1": "v2" },
                createdAt: created.createdAt,
                auditTrail: created.auditTrail,
                isDeleted: false,
            } as any, "user-123", "child-1", mockSignature, "user-123-name");

            const entries = await outboxRepository.getAll();
            const newEntries = entries.slice(baselineEntries.length);
            expect(newEntries).toHaveLength(2);
            expect(newEntries.map((entry) => entry.taskType)).toEqual([
                TaskType.PROCESS_FORENSIC_INTENT,
                TaskType.PUBLISH_EVENT_PROOF,
            ]);
        });
    });

    describe("deleteItem", () => {
        it("does not direct-schedule proof publication for deletes when outbox is enabled", async () => {
            const serviceWithOutbox = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                new InMemoryTimelineMutationRequestRepository(),
                new InMemoryTaskOutboxRepository(),
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "v1", "dad-1": "v1" }
            };

            const created = await serviceWithOutbox.createItem({
                ...dto,
                ...mockSignature,
                idempotencyKey: "idem-delete-outbox",
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            (mockTaskManager.schedule as any).mockClear();

            await serviceWithOutbox.deleteItem(created.id, "user-123", mockSignature, "user-123-name");

            expect(mockTaskManager.schedule).not.toHaveBeenCalledWith(
                TaskType.PUBLISH_EVENT_PROOF,
                expect.anything(),
                expect.anything()
            );
        });

        it("should delete an existing item", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "test-note" }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);
            await service.deleteItem(created.id, "user-123", mockSignature, "user-123-name");

            const items = await service.getItemsByDate("2026-01-27");
            expect(items).toHaveLength(0);
        });

        it("should throw error when deleting non-existent item", async () => {
            await expect(service.deleteItem("non-existent-id", "user-123", mockSignature, "user-123-name")).rejects.toThrow(
                "Timeline item with id non-existent-id not found"
            );
        });

        it("should throw error when non-owner tries to delete", async () => {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "owner-id": "to-be-deleted" }
            };

            const created = await service.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "owner-id",
                createdByName: "owner-name"
            } as any);
            await expect(
                service.deleteItem(created.id, "other-id", mockSignature, "other-name")
            ).rejects.toThrow("Unauthorized: You can only delete your own items");
        });

        it("writes durable outbox entries for forensic processing and proof publish on delete", async () => {
            const outboxRepository = new InMemoryTaskOutboxRepository();
            const outboxBackedService = new TimelineServiceImpl(
                repository,
                new RealDateProvider(),
                new RealUuidProvider(),
                new MockCryptoService(),
                mockChildRepository,
                mockPasskeyRepository,
                mockForensicIntentRepository,
                mockTaskManager,
                undefined,
                outboxRepository,
            );

            const dto: CreateTimelineItemDto & { childId: string } = {
                type: "NOTE",
                date: "2026-01-27",
                childId: "child-1",
                encryption: "ENCRYPTED",
                encryptedPayload: { "user-123": "delete-me" }
            };

            const created = await outboxBackedService.createItem({
                ...dto,
                ...mockSignature,
                createdBy: "user-123",
                createdByName: "user-123-name"
            } as any);

            const baselineEntries = await outboxRepository.getAll();

            await outboxBackedService.deleteItem(created.id, "user-123", mockSignature, "user-123-name");

            const entries = await outboxRepository.getAll();
            const newEntries = entries.slice(baselineEntries.length);
            expect(newEntries).toHaveLength(2);
            expect(newEntries.map((entry) => entry.taskType)).toEqual([
                TaskType.PROCESS_FORENSIC_INTENT,
                TaskType.PUBLISH_EVENT_PROOF,
            ]);
        });
    });
});
