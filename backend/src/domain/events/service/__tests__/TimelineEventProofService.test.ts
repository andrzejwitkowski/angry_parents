import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import type { EncryptedTimelineItem } from "../../model/TimelineItem";
import type { DateProvider } from "../../../shared/ports/DateProvider";
import type { IEventBlockchainAnchor } from "../../../shared/ports/IEventBlockchainAnchor";
import { TimelineEventProofService } from "../TimelineEventProofService";
import { calculateEventProofHash } from "../eventProofHash";

const anchoredAt = "2026-03-10T12:00:00.000Z";

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

describe("TimelineEventProofService", () => {
    let repository: InMemoryTimelineRepository;
    let blockchainAnchor: IEventBlockchainAnchor;
    let service: TimelineEventProofService;
    const validPublishedTxHash = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    beforeEach(async () => {
        repository = new InMemoryTimelineRepository();
        await repository.save(buildEncryptedTimelineItem());

        blockchainAnchor = {
            publishHash: vi.fn().mockResolvedValue({
                txHash: validPublishedTxHash,
                blockNumber: 987n,
            }),
        };

        service = new TimelineEventProofService(repository, blockchainAnchor, fixedDateProvider);
    });

    it("computes a deterministic hash from the stored snapshot, publishes it, and appends anchored proof history", async () => {
        const storedItem = await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        const expectedHash = calculateEventProofHash(storedItem!.versionHistory[1].snapshot);

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2");

        expect(blockchainAnchor.publishHash).toHaveBeenCalledWith(expectedHash);
        expect(result).toEqual({
            version: 2,
            hash: expectedHash,
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
                txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                blockNumber: "44",
                anchoredAt: "2026-03-10T11:00:00.000Z",
            },
        ]);
        expect(updated?.versionHistory[1].proofHistory).toEqual([
            {
                version: 2,
                hash: expectedHash,
                txHash: validPublishedTxHash,
                blockNumber: "987",
                anchoredAt,
            },
        ]);
    });

    it("wraps blockchain adapter failures with a readable event proof error", async () => {
        const failedAnchor: IEventBlockchainAnchor = {
            publishHash: vi.fn().mockRejectedValue(new Error("rpc timeout")),
        };

        service = new TimelineEventProofService(repository, failedAnchor, fixedDateProvider);

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

        const legacyService = new TimelineEventProofService(legacyRepository, blockchainAnchor, fixedDateProvider);
        const result = await legacyService.publishProof(legacyItem.id);

        expect(result.version).toBe(1);
        const updated = await legacyRepository.findById(legacyItem.id);
        expect(updated?.versionHistory).toHaveLength(1);
        expect(updated?.versionHistory[0].proofHistory).toHaveLength(1);
    });

    it("does not republish when the current version already has a pending proof marker", async () => {
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash: calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot),
        });

        await expect(service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2")).rejects.toThrow(
            "Proof publication already pending for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2; manual recovery required"
        );
        expect(blockchainAnchor.publishHash).toHaveBeenCalledTimes(0);
    });

    it("retries a pending proof marker when retryPending is enabled", async () => {
        const hash = calculateEventProofHash((await repository.findById("6f133670-8d3a-4f53-a033-0f2da65e45d2"))!.versionHistory[1].snapshot);
        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash,
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(blockchainAnchor.publishHash).toHaveBeenCalledWith(hash);
        expect(result).toMatchObject({
            version: 2,
            hash,
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
        });

        const result = await service.publishProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", { retryPending: true });

        expect(result.txHash).toBe(validPublishedTxHash);
        expect(blockchainAnchor.publishHash).toHaveBeenCalledWith(hash);
    });

    it("can publish proof for a deleted timeline item version", async () => {
        const deletedRepository = new InMemoryTimelineRepository();
        const deletedItem = buildEncryptedTimelineItem();
        deletedItem.isDeleted = true;
        deletedItem.versionHistory[1].snapshot.isDeleted = true;
        await deletedRepository.save(deletedItem);

        const deletedService = new TimelineEventProofService(deletedRepository, blockchainAnchor, fixedDateProvider);
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

        const legacyService = new TimelineEventProofService(legacyRepository, blockchainAnchor, fixedDateProvider);
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
