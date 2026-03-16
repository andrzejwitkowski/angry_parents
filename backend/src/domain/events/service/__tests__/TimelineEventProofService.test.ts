import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import type { EncryptedTimelineItem } from "../../model/TimelineItem";
import type { DateProvider } from "../../../shared/ports/DateProvider";
import type { IEventBlockchainAnchor } from "../../../shared/ports/IEventBlockchainAnchor";
import { TaskType } from "../../../shared/ports/TaskScheduler";
import { TimelineEventProofService } from "../TimelineEventProofService";
import { calculateEventProofHash } from "../eventProofHash";

const anchoredAt = "2026-03-10T12:00:00.000Z";
const submittedAt = "2026-03-10T11:59:00.000Z";

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

async function waitForProofStatus(
    repository: InMemoryTimelineRepository,
    itemId: string,
    version: number,
    status: string,
): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const item = await repository.findByIdIncludingDeleted(itemId);
        const proof = item?.versionHistory
            .find((entry) => entry.version === version)
            ?.proofHistory[0];

        if (proof?.status === status) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    throw new Error(`Proof for item ${itemId} version ${version} did not reach status ${status}`);
}

describe("TimelineEventProofService", () => {
    let repository: InMemoryTimelineRepository;
    let blockchainAnchor: IEventBlockchainAnchor;
    let service: TimelineEventProofService;
    let taskManager: { schedule: ReturnType<typeof vi.fn> };
    const validPublishedTxHash = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    function createDeferredReceipt() {
        let resolve!: (value: { txHash: string; blockNumber: bigint }) => void;
        const promise = new Promise<{ txHash: string; blockNumber: bigint }>((res) => {
            resolve = res;
        });

        return { promise, resolve };
    }

    function createDeferredValue<T>() {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((res) => {
            resolve = res;
        });

        return { promise, resolve };
    }

    beforeEach(async () => {
        repository = new InMemoryTimelineRepository();
        await repository.save(buildEncryptedTimelineItem());

        blockchainAnchor = {
            submitHash: vi.fn().mockResolvedValue(validPublishedTxHash),
            waitForPublication: vi.fn().mockResolvedValue({
                txHash: validPublishedTxHash,
                blockNumber: 987n,
            }),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockResolvedValue({
                txHash: validPublishedTxHash,
                blockNumber: 987n,
            })
        };

        taskManager = {
            schedule: vi.fn().mockResolvedValue(undefined)
        };

        service = new TimelineEventProofService(repository, blockchainAnchor, fixedDateProvider, taskManager as any);
    });

    it("computes a deterministic hash from the stored snapshot, publishes it, and appends anchored proof history", async () => {
        const storedItem = await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        const expectedHash = calculateEventProofHash(storedItem!.versionHistory[1].snapshot);

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2");

        expect(blockchainAnchor.submitHash).toHaveBeenCalledWith(expectedHash);
        expect(blockchainAnchor.waitForPublication).toHaveBeenCalledWith(validPublishedTxHash);
        expect(result).toEqual({
            version: 2,
            hash: expectedHash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
        });

        const updated = await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory).toHaveLength(2);
        expect(updated?.versionHistory[0].proofHistory).toEqual([
            {
                version: 1,
                hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "CONFIRMED",
                submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                blockNumber: "44",
                anchoredAt: "2026-03-10T11:00:00.000Z",
            },
        ]);
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash: expectedHash,
                status: "CONFIRMED",
                submittedTxHash: validPublishedTxHash,
                lastAttemptAt: anchoredAt,
                txHash: validPublishedTxHash,
                blockNumber: "987",
                anchoredAt,
            },
        ]);
    });

    it("wraps blockchain adapter failures with a readable event proof error", async () => {
        const failedAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
            waitForPublication: vi.fn(),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
        };

        service = new TimelineEventProofService(repository, failedAnchor, fixedDateProvider, taskManager as any);

        await expect(service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2")).rejects.toThrow(
            "Failed to publish event proof for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2: rpc timeout"
        );
    });

    it("bootstraps legacy items without version history before publishing proof", async () => {
        const legacyRepository = new InMemoryTimelineRepository();
        const legacyItem = buildEncryptedTimelineItem();
        delete (legacyItem as any).eventVersion;
        (legacyItem as any).versionHistory = [];
        await legacyRepository.save(legacyItem);

        const legacyService = new TimelineEventProofService(legacyRepository, blockchainAnchor, fixedDateProvider, taskManager as any);
        const result = await legacyService.publishProof(legacyItem.id);

        expect(result.version).toBe(1);
        const updated = await legacyRepository.findById(legacyItem.id);
        expect(updated?.versionHistory).toHaveLength(1);
        expect(updated?.versionHistory[0].proofHistory).toHaveLength(1);
    });

    it("treats legacy confirmed proof records without explicit status as already confirmed", async () => {
        const hash = calculateEventProofHash(buildEncryptedTimelineItem().versionHistory[1].snapshot);
        const legacyRepository = new InMemoryTimelineRepository();
        const legacyItem = buildEncryptedTimelineItem();
        legacyItem.versionHistory[1].proofHistory = [{
            version: 2,
            hash,
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
        } as any];
        await legacyRepository.save(legacyItem);

        const legacyService = new TimelineEventProofService(legacyRepository, blockchainAnchor, fixedDateProvider, taskManager as any);
        const result = await legacyService.publishProof(legacyItem.id);

        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "CONFIRMED",
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
        });
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
    });

    it("uses the latest proof record for a hash when older stale entries still exist", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("does not republish when the current version already has a pending proof marker", async () => {
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash: calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot),
            status: "CLAIMED",
        });

        await expect(service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2")).rejects.toThrow(
            "Proof publication already pending for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2; manual recovery required"
        );
        expect(blockchainAnchor.submitHash).toHaveBeenCalledTimes(0);
    });

    it("retries a pending proof marker when retryPending is enabled", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(blockchainAnchor.submitHash).toHaveBeenCalledWith(hash);
        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
        });
    });

    it("retries pending proof publication by default for internal flow", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result.txHash).toBe(validPublishedTxHash);
        expect(blockchainAnchor.submitHash).toHaveBeenCalledWith(hash);
    });

    it("stores submitted transaction metadata before waiting for final receipt", async () => {
        const deferredReceipt = createDeferredReceipt();
        const submitFirstAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockResolvedValue(validPublishedTxHash),
            waitForPublication: vi.fn().mockReturnValue(deferredReceipt.promise),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockReturnValue(deferredReceipt.promise),
        };
        service = new TimelineEventProofService(repository, submitFirstAnchor, {
            ...fixedDateProvider,
            getIsoString: () => submittedAt,
        }, taskManager as any);

        const pendingPublication = service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        await waitForProofStatus(repository, "6f133670-8d3a-4f53-a033-0f2da65e45d2", 2, "SUBMITTED");

        const duringSubmit = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(duringSubmit?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash: calculateEventProofHash(duringSubmit!.versionHistory[1].snapshot),
                status: "SUBMITTED",
                submittedTxHash: validPublishedTxHash,
                lastAttemptAt: submittedAt,
            },
        ]);

        deferredReceipt.resolve({
            txHash: validPublishedTxHash,
            blockNumber: 987n,
        });

        const result = await pendingPublication;
        expect(result.status).toBe("CONFIRMED");
        expect(result.submittedTxHash).toBe(validPublishedTxHash);
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("returns a submitted proof and schedules reconciliation instead of resubmitting", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toEqual({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
        expect(blockchainAnchor.waitForPublication).not.toHaveBeenCalled();
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("returns the persisted RECONCILING proof state instead of rewriting it to SUBMITTED in memory", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "RECONCILING",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toEqual({
            version: 2,
            hash,
            status: "RECONCILING",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        });
        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([{
            version: 2,
            hash,
            status: "RECONCILING",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
        }]);
    });

    it("retries a failed proof with a submitted tx hash by resuming reconciliation instead of submitting again", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "FAILED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: submittedAt,
            lastError: "receipt lookup exhausted",
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toEqual({
            version: 2,
            hash,
            status: "RECONCILING",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: anchoredAt,
            lastError: "receipt lookup exhausted",
        });
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
        expect(blockchainAnchor.waitForPublication).not.toHaveBeenCalled();
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash,
                status: "RECONCILING",
                submittedTxHash: validPublishedTxHash,
                lastAttemptAt: anchoredAt,
                lastError: "receipt lookup exhausted",
            },
        ]);
    });

    it("routes failed proof retry without submitted tx hash back through the claimed publication path", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "FAILED",
            lastAttemptAt: submittedAt,
            lastError: "receipt lookup exhausted",
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(blockchainAnchor.submitHash).toHaveBeenCalledWith(hash);
        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
        });

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory[0]).toEqual({
            version: 2,
            hash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
            lastAttemptAt: anchoredAt,
        });
    });

    it("clears stale proof metadata before restarting claimed-state publication", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "FAILED",
            txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            blockNumber: "123",
            anchoredAt: "2026-03-11T10:00:00.000Z",
            lastAttemptAt: submittedAt,
            lastError: "receipt lookup exhausted",
        });

        await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory[0]).toEqual({
            version: 2,
            hash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
            blockNumber: "987",
            anchoredAt,
            lastAttemptAt: anchoredAt,
        });
    });

    it("routes reconciling proof retry without submitted tx hash back through the claimed publication path", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "RECONCILING",
            lastAttemptAt: submittedAt,
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(blockchainAnchor.submitHash).toHaveBeenCalledWith(hash);
        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
            txHash: validPublishedTxHash,
        });
    });

    it("does not double-submit when retrying a claimed proof concurrently", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const deferredTxHash = createDeferredValue<string>();
        const delayedReceiptAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockReturnValue(deferredTxHash.promise),
            waitForPublication: vi.fn().mockRejectedValue(new Error("receipt delayed")),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("receipt delayed")),
        };

        const firstService = new TimelineEventProofService(repository, delayedReceiptAnchor, fixedDateProvider, taskManager as any);
        const secondService = new TimelineEventProofService(repository, delayedReceiptAnchor, fixedDateProvider, taskManager as any);

        const firstPublication = firstService.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });
        const secondPublication = secondService.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(delayedReceiptAnchor.submitHash).toHaveBeenCalledTimes(1);

        deferredTxHash.resolve(validPublishedTxHash);

        const [firstResult, secondResult] = await Promise.all([firstPublication, secondPublication]);
        expect([firstResult.status, secondResult.status].sort()).toEqual(["RECONCILING", "SUBMITTED"]);

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory[0]).toMatchObject({
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
        });
    });

    it("returns a submitted proof when receipt waiting is delayed after tx submission", async () => {
        const delayedReceiptAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockResolvedValue(validPublishedTxHash),
            waitForPublication: vi.fn().mockRejectedValue(new Error("receipt delayed")),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("receipt delayed")),
        };
        service = new TimelineEventProofService(repository, delayedReceiptAnchor, fixedDateProvider, taskManager as any);

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2");

        expect(result).toEqual({
            version: 2,
            hash: calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot),
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastAttemptAt: anchoredAt,
        });
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("does not swallow non-recoverable publication errors after tx submission", async () => {
        const failedReceiptAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockResolvedValue(validPublishedTxHash),
            waitForPublication: vi.fn().mockRejectedValue(new Error("rpc timeout")),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
        };
        service = new TimelineEventProofService(repository, failedReceiptAnchor, fixedDateProvider, taskManager as any);

        await expect(service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2")).rejects.toThrow(
            "Failed to publish event proof for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2: rpc timeout"
        );
    });

    it("keeps a claimed proof recoverable when submitHash fails before any tx hash is persisted", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        const failedSubmitAnchor: IEventBlockchainAnchor = {
            submitHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
            waitForPublication: vi.fn(),
            getReceipt: vi.fn(),
            publishHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
        };
        service = new TimelineEventProofService(repository, failedSubmitAnchor, fixedDateProvider, taskManager as any);

        await expect(service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2")).rejects.toThrow(
            "Failed to publish event proof for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2: rpc timeout"
        );

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash,
                status: "CLAIMED",
            },
        ]);
    });

    it("preserves the submitted tx hash in proof history when submit succeeds but persisting SUBMITTED fails", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const realMarkProofSubmitted = repository.markProofSubmitted.bind(repository);
        let firstCall = true;
        repository.markProofSubmitted = vi.fn(async (id, proof, session) => {
            if (firstCall) {
                firstCall = false;
                throw new Error("mongo unavailable");
            }

            return realMarkProofSubmitted(id, proof, session);
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastError: "mongo unavailable",
        });

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash,
                status: "SUBMITTED",
                submittedTxHash: validPublishedTxHash,
                lastAttemptAt: anchoredAt,
                lastError: "mongo unavailable",
            },
        ]);
    });

    it("schedules reconciliation when fallback proof persistence succeeds after markProofSubmitted fails", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        const realMarkProofSubmitted = repository.markProofSubmitted.bind(repository);
        let firstCall = true;
        repository.markProofSubmitted = vi.fn(async (id, proof, session) => {
            if (firstCall) {
                firstCall = false;
                throw new Error("mongo unavailable");
            }

            return realMarkProofSubmitted(id, proof, session);
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastError: "mongo unavailable",
        });
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("schedules reconciliation with the submitted tx hash when proof persistence failed after submit", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        repository.markProofSubmitted = vi.fn(async () => {
            throw new Error("mongo unavailable");
        });
        repository.replaceProofRecord = vi.fn(async () => {
            throw new Error("mongo unavailable");
        });

        const firstResult = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });
        expect(firstResult).toMatchObject({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastError: "mongo unavailable",
        });
        expect(blockchainAnchor.submitHash).toHaveBeenCalledTimes(1);
        expect(taskManager.schedule).toHaveBeenCalledWith(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: "6f133670-8d3a-4f53-a033-0f2da65e45d2", version: 2, submittedTxHash: validPublishedTxHash },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });

    it("treats reconciliation scheduling as best effort after persisting submitted state", async () => {
        taskManager.schedule.mockRejectedValueOnce(new Error("scheduler offline"));

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2");

        expect(result.status).toBe("CONFIRMED");
        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory[0]).toMatchObject({
            status: "CONFIRMED",
            submittedTxHash: validPublishedTxHash,
        });
    });

    it("persists a recoverable submitted proof when post-submit persistence and reconciliation scheduling both fail", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
            status: "CLAIMED",
        });

        repository.markProofSubmitted = vi.fn(async () => {
            throw new Error("mongo unavailable");
        });
        repository.replaceProofRecord = vi.fn(async () => {
            throw new Error("replace failed");
        });
        taskManager.schedule.mockRejectedValue(new Error("scheduler offline"));

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result).toMatchObject({
            version: 2,
            hash,
            status: "SUBMITTED",
            submittedTxHash: validPublishedTxHash,
            lastError: "mongo unavailable",
        });

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash,
                status: "SUBMITTED",
                submittedTxHash: validPublishedTxHash,
                lastAttemptAt: anchoredAt,
                lastError: "mongo unavailable",
            },
        ]);
    });

    it("can publish proof for a deleted timeline item version", async () => {
        const deletedRepository = new InMemoryTimelineRepository();
        const deletedItem = buildEncryptedTimelineItem();
        deletedItem.isDeleted = true;
        deletedItem.versionHistory[1].snapshot.isDeleted = true;
        await deletedRepository.save(deletedItem);

        const deletedService = new TimelineEventProofService(deletedRepository, blockchainAnchor, fixedDateProvider, taskManager as any);
        const result = await deletedService.publishProof(deletedItem.id);

        expect(result.version).toBe(2);
        expect(result.txHash).toBe(validPublishedTxHash);
    });

    it("normalizes legacy non-ISO createdAt before bootstrapping snapshot history", async () => {
        const legacyRepository = new InMemoryTimelineRepository();
        const legacyItem = buildEncryptedTimelineItem();
        (legacyItem as any).createdAt = new Date("2026-03-10T10:30:00.000Z");
        delete (legacyItem as any).eventVersion;
        (legacyItem as any).versionHistory = [];
        await legacyRepository.save(legacyItem);

        const legacyService = new TimelineEventProofService(legacyRepository, blockchainAnchor, fixedDateProvider, taskManager as any);
        await legacyService.publishProof(legacyItem.id);

        const updated = await legacyRepository.findByIdIncludingDeleted(legacyItem.id);
        expect(updated?.versionHistory[0].snapshot.createdAt).toBe("2026-03-10T10:30:00.000Z");
    });

    it("omits undefined optional fields from canonical event-proof hashing", async () => {
        const snapshotWithUndefinedOptionals = {
            ...buildEncryptedTimelineItem().versionHistory[1].snapshot,
            ciphertext: undefined,
        };

        const snapshotWithOmittedOptionals = Object.fromEntries(
            Object.entries(snapshotWithUndefinedOptionals).filter(([, value]) => value !== undefined)
        ) as typeof snapshotWithUndefinedOptionals;

        expect(calculateEventProofHash(snapshotWithUndefinedOptionals)).toBe(
            calculateEventProofHash(snapshotWithOmittedOptionals)
        );
    });

    it("sorts canonical object keys deterministically without locale-dependent comparison", async () => {
        const originalLocaleCompare = String.prototype.localeCompare;
        String.prototype.localeCompare = (() => {
            throw new Error("localeCompare should not be used for event proof hashing");
        }) as typeof String.prototype.localeCompare;

        try {
            expect(() => calculateEventProofHash(buildEncryptedTimelineItem().versionHistory[1].snapshot)).not.toThrow();
        } finally {
            String.prototype.localeCompare = originalLocaleCompare;
        }
    });
});
