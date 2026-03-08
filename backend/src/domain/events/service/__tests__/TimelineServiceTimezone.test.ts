import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimelineServiceImpl } from "../TimelineService";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { RealUuidProvider } from "../../../../shared/providers/RealUuidProvider";
import type { CreateTimelineItemDto } from "../../model/TimelineItem";
import type { ICryptoService } from "../../../shared/ports/ICryptoService";
import type { DateProvider } from "../../../shared/ports/DateProvider";
import type { ChildRepository } from "../../../family/ports/ChildRepository";
import type { PasskeyRepository } from "../../../auth/ports/PasskeyRepository";
import { TaskStatus, TaskType } from "../../../shared/ports/TaskScheduler";

// Mock Crypto Service
class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> { return true; }
    async getFingerprint(): Promise<string> { return "mock-fingerprint"; }
    async encryptRSA(plaintext: string, publicKey: string): Promise<string> {
        return `encrypted-${plaintext.substring(0, 10)}`;
    }
}

describe("TimelineService - Timezone Regression", () => {
    let service: TimelineServiceImpl;
    let repository: InMemoryTimelineRepository;
    let mockDateProvider: DateProvider;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();

        const mockChildRepository: ChildRepository = {
            save: vi.fn().mockImplementation(async (child) => child),
            findAllByFamilyId: vi.fn().mockResolvedValue([]),
            findById: vi.fn().mockResolvedValue({
                id: "child-1",
                familyId: "family-1"
            }),
            delete: vi.fn().mockResolvedValue(undefined)
        };

        const mockPasskeyRepository: PasskeyRepository = {
            save: vi.fn().mockResolvedValue(undefined),
            findByUserId: vi.fn().mockResolvedValue([
                {
                    userId: "user-1",
                    webauthnUserId: "webauthn-user-1",
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

        mockDateProvider = {
            getNow: vi.fn(),
            getIsoString: vi.fn().mockReturnValue(new Date().toISOString())
        };

        service = new TimelineServiceImpl(
            repository,
            mockDateProvider,
            new RealUuidProvider(),
            new MockCryptoService(),
            mockChildRepository,
            mockPasskeyRepository,
            {
                save: vi.fn(),
                findById: vi.fn().mockResolvedValue(null),
                markProcessing: vi.fn().mockResolvedValue(true),
                markCompleted: vi.fn().mockResolvedValue(undefined),
                markRetry: vi.fn().mockResolvedValue(undefined)
            },
            {
                registerHandler: vi.fn(),
                schedule: vi.fn().mockImplementation(async (type, payload) => ({
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
                })),
                start: vi.fn(),
                stop: vi.fn()
            }
        );
    });

    /**
     * This test ensures that even if "now" is late in the day (e.g. 23:59),
     * a handover for "today" (same-day) is correctly accepted.
     * The bug was that new Date("YYYY-MM-DD") could produce a UTC midnight 
     * which in many timezones is technically "in the past" relative to local midnight.
     */
    it("should accept handover for today even if it is late in the evening", async () => {
        // Mock "now" to be late in the evening of 2026-03-06
        const mockedNow = new Date(2026, 2, 6, 23, 59, 59); // March 6, 2026, 23:59:59 (Local)
        (mockDateProvider.getNow as any).mockReturnValue(new Date(mockedNow));

        const dto = {
            type: "HANDOVER",
            date: "2026-03-06", // Same day
            createdBy: "user-1",
            createdByName: "User 1",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-1": "encrypted-handover" },
        } as any;

        const result = await service.createItem({
            ...dto,
            signatureBase64: "sig",
            timestamp: mockedNow.toISOString(),
            keyId: "key1"
        } as any);

        expect(result).toBeDefined();
        expect(result.type).toBe("HANDOVER");
    });

    it("should still reject handover for yesterday", async () => {
        const mockedNow = new Date(2026, 2, 6, 12, 0, 0); // March 6, 2026, Noon
        (mockDateProvider.getNow as any).mockReturnValue(new Date(mockedNow));

        const dto = {
            type: "HANDOVER",
            date: "2026-03-05", // Yesterday
            createdBy: "user-1",
            createdByName: "User 1",
            childId: "child-1",
            encryption: "ENCRYPTED",
            encryptedPayload: { "user-1": "encrypted-handover" },
        } as any;

        await expect(service.createItem({
            ...dto,
            signatureBase64: "sig",
            timestamp: mockedNow.toISOString(),
            keyId: "key1"
        } as any)).rejects.toThrow("Handover date cannot be in the past");
    });
});
