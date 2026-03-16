import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoMemory, disconnectMongoMemory } from "../../../../adapters/mongo/__tests__/mongoMemoryServer";
import { MongoTimelineRepository } from "../../../../adapters/mongo/repositories/events/MongoTimelineRepository";
import { TimelineItemModel } from "../../../../adapters/mongo/models/TimelineItemModel";
import type { DateProvider } from "../../../shared/ports/DateProvider";
import type { EncryptedTimelineItem } from "../../model/TimelineItem";
import type { IEventBlockchainAnchor } from "../../../shared/ports/IEventBlockchainAnchor";
import { TimelineEventProofService } from "../TimelineEventProofService";
import { calculateEventProofHash } from "../eventProofHash";

const anchoredAt = "2026-03-10T12:00:00.000Z";
const submittedTxHash = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const fixedDateProvider: DateProvider = {
    getNow: () => new Date(anchoredAt),
    getIsoString: () => anchoredAt,
};

function buildEncryptedTimelineItem(): EncryptedTimelineItem {
    return {
        id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
        type: "NOTE",
        date: "2026-03-10",
        createdAt: "2026-03-10T10:30:00.000Z",
        createdBy: "dad-1",
        createdByName: "Alice",
        auditTrail: [{
            timestamp: "2026-03-10T10:30:00.000Z",
            userId: "dad-1",
            userName: "Alice",
            action: "CREATED",
        }],
        isDeleted: false,
        childIds: ["child-1"],
        encryption: "ENCRYPTED",
        encryptedPayload: {
            "dad-1": "ciphertext-v2",
            "mom-1": "ciphertext-v2-mom",
        },
        eventVersion: 2,
        versionHistory: [
            {
                version: 1,
                snapshot: {
                    id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
                    type: "NOTE",
                    date: "2026-03-10",
                    createdAt: "2026-03-10T10:30:00.000Z",
                    createdBy: "dad-1",
                    createdByName: "Alice",
                    auditTrail: [{
                        timestamp: "2026-03-10T10:30:00.000Z",
                        userId: "dad-1",
                        userName: "Alice",
                        action: "CREATED",
                    }],
                    isDeleted: false,
                    childIds: ["child-1"],
                    encryption: "ENCRYPTED",
                    encryptedPayload: {
                        "dad-1": "ciphertext-v1",
                        "mom-1": "ciphertext-v1-mom",
                    },
                },
                proofHistory: [{
                    version: 1,
                    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    status: "CONFIRMED",
                    submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    blockNumber: "44",
                    anchoredAt: "2026-03-10T11:00:00.000Z",
                }],
            },
            {
                version: 2,
                snapshot: {
                    id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
                    type: "NOTE",
                    date: "2026-03-10",
                    createdAt: "2026-03-10T10:30:00.000Z",
                    createdBy: "dad-1",
                    createdByName: "Alice",
                    auditTrail: [
                        {
                            timestamp: "2026-03-10T10:30:00.000Z",
                            userId: "dad-1",
                            userName: "Alice",
                            action: "CREATED",
                        },
                        {
                            timestamp: "2026-03-10T10:45:00.000Z",
                            userId: "dad-1",
                            userName: "Alice",
                            action: "UPDATED",
                            changes: { note: "Field-level changes hidden due to encryption" },
                        },
                    ],
                    isDeleted: false,
                    childIds: ["child-1"],
                    encryption: "ENCRYPTED",
                    encryptedPayload: {
                        "dad-1": "ciphertext-v2",
                        "mom-1": "ciphertext-v2-mom",
                    },
                },
                proofHistory: [],
            },
        ],
    };
}

function createDeferredValue<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });

    return { promise, resolve };
}

async function waitForSubmitCallCount(mockFn: ReturnType<typeof vi.fn>, expectedCount: number) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5000) {
        if (mockFn.mock.calls.length === expectedCount) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`Timed out waiting for submitHash to be called ${expectedCount} time(s)`);
}

describe("TimelineEventProofService Mongo integration", () => {
    let mongoServer: MongoMemoryServer;
    let repository: MongoTimelineRepository;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoTimelineRepository();
    }, 300000);

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    }, 300000);

    beforeEach(async () => {
        await TimelineItemModel.deleteMany({});
        await repository.save(buildEncryptedTimelineItem() as any);
    });

    it("submits the hash only once when two Mongo-backed retryPending publishers race on the same claimed proof", async () => {
        const hash = calculateEventProofHash(buildEncryptedTimelineItem().versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const deferredTxHash = createDeferredValue<string>();
        const blockchainAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockReturnValue(deferredTxHash.promise),
            waitForPublication: vi.fn().mockRejectedValue(new Error("receipt delayed")),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("receipt delayed")),
        };
        const taskManager = { schedule: vi.fn().mockResolvedValue(undefined) };

        const firstService = new TimelineEventProofService(repository, blockchainAnchor, fixedDateProvider, taskManager as any);
        const secondService = new TimelineEventProofService(repository, blockchainAnchor, fixedDateProvider, taskManager as any);

        const firstPublication = firstService.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });
        const secondPublication = secondService.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        await waitForSubmitCallCount(blockchainAnchor.submitHash as ReturnType<typeof vi.fn>, 1);

        deferredTxHash.resolve(submittedTxHash);

        const [firstResult, secondResult] = await Promise.all([firstPublication, secondPublication]);
        expect([firstResult.status, secondResult.status].sort()).toEqual(["RECONCILING", "SUBMITTED"]);

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash,
                status: "SUBMITTED",
                submittedTxHash,
                lastAttemptAt: anchoredAt,
            },
        ]);
    });
});
