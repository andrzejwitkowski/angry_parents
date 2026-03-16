import { describe, expect, it, vi } from "vitest";
import { TimelineApiService } from "../TimelineApiService";

describe("TimelineApiService", () => {
    const user = {
        id: "user-1",
        familyId: "family-1",
        role: "mom" as const,
        email: "mom@example.com",
        name: "Mom"
    };

    const childRepository = {
        findById: vi.fn().mockResolvedValue({
            id: "child-1",
            familyId: "family-1"
        })
    };

    function createService(item: Record<string, unknown>) {
        const timelineRepository = {
            findByIdIncludingDeleted: vi.fn().mockResolvedValue(item)
        };

        return new TimelineApiService(
            {} as any,
            childRepository as any,
            timelineRepository as any,
            undefined
        );
    }

    function createTimelineItem(proofHistory: Array<Record<string, unknown>>) {
        return {
            id: "event-1",
            childIds: ["child-1"],
            versionHistory: [
                {
                    version: 1,
                    proofHistory
                }
            ]
        };
    }

    it("keeps the legacy not found error when the event exists but has no proof records yet", async () => {
        const service = createService({
            id: "event-1",
            childIds: ["child-1"],
            versionHistory: []
        });

        await expect(service.getEventProof("event-1", user)).rejects.toThrow(
            "Timeline item with id event-1 proof not found"
        );
    });

    it("returns the latest lifecycle status for an unconfirmed proof", async () => {
        const service = createService(createTimelineItem([
            {
                version: 1,
                hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                status: "CLAIMED"
            },
            {
                version: 1,
                hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                status: "SUBMITTED",
                submittedTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            {
                version: 1,
                hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                status: "RECONCILING",
                submittedTxHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                lastAttemptAt: "2026-03-12T10:00:00.000Z"
            }
        ]));

        await expect(service.getEventProof("event-1", user)).resolves.toEqual({
            status: "RECONCILING",
            hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            submittedTxHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            lastAttemptAt: "2026-03-12T10:00:00.000Z"
        });
    });

    it("returns failed proof details without pretending the proof is missing", async () => {
        const service = createService(createTimelineItem([
            {
                version: 1,
                hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                status: "FAILED",
                lastError: "rpc timeout",
                lastAttemptAt: "2026-03-12T11:00:00.000Z"
            }
        ]));

        await expect(service.getEventProof("event-1", user)).resolves.toEqual({
            status: "FAILED",
            hash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            lastError: "rpc timeout",
            lastAttemptAt: "2026-03-12T11:00:00.000Z"
        });
    });

    it("returns confirmed proof status while preserving anchored proof fields", async () => {
        const service = createService(createTimelineItem([
            {
                version: 1,
                hash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                status: "SUBMITTED",
                submittedTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111"
            },
            {
                version: 1,
                hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                status: "CONFIRMED",
                txHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                blockNumber: "201",
                anchoredAt: "2026-03-12T12:00:00.000Z"
            }
        ]));

        await expect(service.getEventProof("event-1", user)).resolves.toEqual({
            status: "CONFIRMED",
            hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            txHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            blockNumber: "201"
        });
    });

    it("derives CONFIRMED status for legacy anchored proof records without explicit status", async () => {
        const service = createService(createTimelineItem([
            {
                version: 1,
                hash: "abababababababababababababababababababababababababababababababab",
                txHash: "0xabababababababababababababababababababababababababababababababab",
                blockNumber: "300",
                anchoredAt: "2026-03-12T12:00:00.000Z"
            }
        ]));

        await expect(service.getEventProof("event-1", user)).resolves.toEqual({
            status: "CONFIRMED",
            hash: "abababababababababababababababababababababababababababababababab",
            txHash: "0xabababababababababababababababababababababababababababababababab",
            blockNumber: "300"
        });
    });

    it("prefers a confirmed proof within the latest version over a later stale non-confirmed entry", async () => {
        const service = createService({
            id: "event-1",
            childIds: ["child-1"],
            versionHistory: [
                {
                    version: 1,
                    proofHistory: [{
                        version: 1,
                        hash: "1111111111111111111111111111111111111111111111111111111111111111",
                        status: "CONFIRMED",
                        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
                        blockNumber: "100",
                        anchoredAt: "2026-03-12T09:00:00.000Z"
                    }]
                },
                {
                    version: 2,
                    proofHistory: [
                        {
                            version: 2,
                            hash: "2222222222222222222222222222222222222222222222222222222222222222",
                            status: "CONFIRMED",
                            txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
                            blockNumber: "200",
                            anchoredAt: "2026-03-12T10:00:00.000Z"
                        },
                        {
                            version: 2,
                            hash: "3333333333333333333333333333333333333333333333333333333333333333",
                            status: "RECONCILING",
                            submittedTxHash: "0x3333333333333333333333333333333333333333333333333333333333333333"
                        }
                    ]
                }
            ]
        });

        await expect(service.getEventProof("event-1", user)).resolves.toEqual({
            status: "CONFIRMED",
            hash: "2222222222222222222222222222222222222222222222222222222222222222",
            txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
            blockNumber: "200"
        });
    });

    it("does not fall back to an older version when the latest version has no proof yet", async () => {
        const service = createService({
            id: "event-1",
            childIds: ["child-1"],
            versionHistory: [
                {
                    version: 1,
                    proofHistory: [{
                        version: 1,
                        hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        status: "CONFIRMED",
                        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        blockNumber: "101",
                        anchoredAt: "2026-03-12T09:00:00.000Z"
                    }]
                },
                {
                    version: 2,
                    proofHistory: []
                }
            ]
        });

        await expect(service.getEventProof("event-1", user)).rejects.toThrow(
            "Timeline item with id event-1 proof not found"
        );
    });

    it("checks child ownership in parallel and still reports infrastructure lookup failures", async () => {
        const startedLookups: string[] = [];

        const childRepository = {
            findById: vi.fn()
                .mockImplementation(async (childId: string) => {
                    startedLookups.push(childId);

                    if (childId === "child-1") {
                        await new Promise((resolve) => setTimeout(resolve, 20));
                        return { id: "child-1", familyId: "family-1" };
                    }

                    expect(startedLookups).toContain("child-1");
                    expect(startedLookups).toContain("child-2");
                    throw new Error("database offline");
                })
        };

        const timelineRepository = {
            findByIdIncludingDeleted: vi.fn().mockResolvedValue({
                id: "event-1",
                childIds: ["child-1", "child-2"],
                versionHistory: []
            })
        };

        const service = new TimelineApiService(
            {} as any,
            childRepository as any,
            timelineRepository as any,
            undefined
        );

        await expect(service.getEventProof("event-1", {
            id: "user-1",
            familyId: "family-1",
            role: "mom",
            email: "mom@example.com",
            name: "Mom"
        })).rejects.toThrow("Failed to resolve child ownership for timeline item: database offline");

        expect(childRepository.findById).toHaveBeenCalledTimes(2);
        expect(startedLookups).toEqual(["child-1", "child-2"]);
    });
});
