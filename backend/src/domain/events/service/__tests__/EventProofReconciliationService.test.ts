import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import type { DateProvider } from "../../../shared/ports/DateProvider";
import type { EncryptedTimelineItem, EventProofRecord } from "../../model/TimelineItem";
import { EventProofReconciliationService } from "../EventProofReconciliationService";

const reconciledAt = "2026-03-12T12:00:00.000Z";
const submittedTxHash = "0x1111111111111111111111111111111111111111111111111111111111111111";

const fixedDateProvider: DateProvider = {
    getNow: () => new Date(reconciledAt),
    getIsoString: () => reconciledAt,
};

function buildItemWithProof(proof: EventProofRecord): EncryptedTimelineItem {
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
            "dad-1": "ciphertext-v1",
            "mom-1": "ciphertext-v1-mom",
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
                        "dad-1": "ciphertext-v0",
                        "mom-1": "ciphertext-v0-mom",
                    },
                },
                proofHistory: [],
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
                proofHistory: [proof],
            },
        ],
    };
}

describe("EventProofReconciliationService", () => {
    let repository: InMemoryTimelineRepository;
    let blockchainAnchor: {
        submitHash: ReturnType<typeof vi.fn>;
        waitForPublication: ReturnType<typeof vi.fn>;
        publishHash: ReturnType<typeof vi.fn>;
        getReceipt: ReturnType<typeof vi.fn>;
    };
    let service: EventProofReconciliationService;

    beforeEach(() => {
        repository = new InMemoryTimelineRepository();
        blockchainAnchor = {
            submitHash: vi.fn(),
            waitForPublication: vi.fn(),
            publishHash: vi.fn(),
            getReceipt: vi.fn(),
        };
        service = new EventProofReconciliationService(repository, blockchainAnchor as any, fixedDateProvider);
    });

    it("confirms a submitted proof when the blockchain receipt is available", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
        }));
        blockchainAnchor.getReceipt.mockResolvedValue({
            txHash: submittedTxHash,
            blockNumber: 456n,
        });

        const result = await service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2);

        expect(result).toEqual({
            version: 2,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "CONFIRMED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
            txHash: submittedTxHash,
            blockNumber: "456",
            anchoredAt: reconciledAt,
        });
        expect(blockchainAnchor.getReceipt).toHaveBeenCalledWith(submittedTxHash);
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
        expect(blockchainAnchor.waitForPublication).not.toHaveBeenCalled();
        expect(blockchainAnchor.publishHash).not.toHaveBeenCalled();

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([{
            version: 2,
            hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            status: "CONFIRMED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
            txHash: submittedTxHash,
            blockNumber: "456",
            anchoredAt: reconciledAt,
        }]);
    });

    it("returns the current submitted proof unchanged when no receipt is found", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
        }));
        blockchainAnchor.getReceipt.mockResolvedValue(null);

        const result = await service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2);

        expect(result).toEqual({
            version: 2,
            hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
        });
        expect(blockchainAnchor.getReceipt).toHaveBeenCalledWith(submittedTxHash);
        expect(blockchainAnchor.submitHash).not.toHaveBeenCalled();
        expect(blockchainAnchor.waitForPublication).not.toHaveBeenCalled();
        expect(blockchainAnchor.publishHash).not.toHaveBeenCalled();

        const stored = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(stored?.versionHistory[1].proofHistory).toEqual([{
            version: 2,
            hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
        }]);
    });

    it("reconciles a RECONCILING proof when a submitted tx hash is supplied out-of-band", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "abababababababababababababababababababababababababababababababab",
            status: "RECONCILING",
        }));
        blockchainAnchor.getReceipt.mockResolvedValue({
            txHash: submittedTxHash,
            blockNumber: 456n,
        });

        const result = await service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2, submittedTxHash);

        expect(result).toEqual({
            version: 2,
            hash: "abababababababababababababababababababababababababababababababab",
            status: "CONFIRMED",
            submittedTxHash,
            txHash: submittedTxHash,
            blockNumber: "456",
            anchoredAt: reconciledAt,
        });
    });

    it("persists an out-of-band submitted tx hash while receipt lookup is still pending", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
            status: "RECONCILING",
        }));
        blockchainAnchor.getReceipt.mockResolvedValue(null);

        const result = await service.reconcileProof(
            "6f133670-8d3a-4f53-a033-0f2da65e45d2",
            2,
            submittedTxHash
        );

        expect(result).toEqual({
            version: 2,
            hash: "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
            status: "RECONCILING",
            submittedTxHash,
        });

        const stored = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(stored?.versionHistory[1].proofHistory).toEqual([{
            version: 2,
            hash: "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
            status: "RECONCILING",
            submittedTxHash,
        }]);
    });

    it("returns an already confirmed proof unchanged", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            status: "CONFIRMED",
            submittedTxHash,
            txHash: submittedTxHash,
            blockNumber: "44",
            anchoredAt: "2026-03-12T11:00:00.000Z",
        }));

        const result = await service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2);

        expect(result).toEqual({
            version: 2,
            hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            status: "CONFIRMED",
            submittedTxHash,
            txHash: submittedTxHash,
            blockNumber: "44",
            anchoredAt: "2026-03-12T11:00:00.000Z",
        });
        expect(blockchainAnchor.getReceipt).not.toHaveBeenCalled();
    });

    it("throws a readable error when the requested version has no proof record", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            status: "SUBMITTED",
            submittedTxHash,
        }));

        await expect(service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 1)).rejects.toThrow(
            "No proof record found for timeline item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 1"
        );
    });

    it("propagates receipt lookup failures that are not a missing receipt", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            status: "SUBMITTED",
            submittedTxHash,
        }));
        blockchainAnchor.getReceipt.mockRejectedValue(new Error("rpc timeout"));

        await expect(service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2)).rejects.toThrow("rpc timeout");
    });

    it("marks a submitted proof as FAILED with lastError when reconciliation is exhausted", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "1212121212121212121212121212121212121212121212121212121212121212",
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T11:55:00.000Z",
        }));

        const result = await service.markProofReconciliationFailed(
            "6f133670-8d3a-4f53-a033-0f2da65e45d2",
            2,
            "receipt lookup exhausted"
        );

        expect(result).toEqual({
            version: 2,
            hash: "1212121212121212121212121212121212121212121212121212121212121212",
            status: "FAILED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T12:00:00.000Z",
            lastError: "receipt lookup exhausted",
        });

        const updated = await repository.findByIdIncludingDeleted("6f133670-8d3a-4f53-a033-0f2da65e45d2");
        expect(updated?.versionHistory[1].proofHistory).toEqual([{
            version: 2,
            hash: "1212121212121212121212121212121212121212121212121212121212121212",
            status: "FAILED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T12:00:00.000Z",
            lastError: "receipt lookup exhausted",
        }]);
    });

    it("preserves an out-of-band submitted tx hash when marking reconciliation as failed", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "3434343434343434343434343434343434343434343434343434343434343434",
            status: "RECONCILING",
        }));

        const result = await service.markProofReconciliationFailed(
            "6f133670-8d3a-4f53-a033-0f2da65e45d2",
            2,
            "receipt lookup exhausted",
            submittedTxHash
        );

        expect(result).toEqual({
            version: 2,
            hash: "3434343434343434343434343434343434343434343434343434343434343434",
            status: "FAILED",
            submittedTxHash,
            lastAttemptAt: "2026-03-12T12:00:00.000Z",
            lastError: "receipt lookup exhausted",
        });
    });

    it("prefers an existing confirmed proof when multiple proof records exist for the same version", async () => {
        await repository.save(buildItemWithProof({
            version: 2,
            hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            status: "SUBMITTED",
            submittedTxHash,
        }));

        await repository.appendProofRecord("6f133670-8d3a-4f53-a033-0f2da65e45d2", {
            version: 2,
            hash: "9999999999999999999999999999999999999999999999999999999999999999",
            status: "CONFIRMED",
            submittedTxHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
            txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
            blockNumber: "77",
            anchoredAt: "2026-03-12T11:00:00.000Z",
        });

        const result = await service.reconcileProof("6f133670-8d3a-4f53-a033-0f2da65e45d2", 2);

        expect(result).toEqual({
            version: 2,
            hash: "9999999999999999999999999999999999999999999999999999999999999999",
            status: "CONFIRMED",
            submittedTxHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
            txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
            blockNumber: "77",
            anchoredAt: "2026-03-12T11:00:00.000Z",
        });
        expect(blockchainAnchor.getReceipt).not.toHaveBeenCalled();
    });
});
