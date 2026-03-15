import { describe, expect, it } from "vitest";
import { TimelineItemSchema } from "../TimelineItem";

const baseEncryptedItem = {
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
    eventVersion: 1,
};

describe("TimelineItemSchema legacy proof parsing", () => {
    it("derives CONFIRMED for legacy anchored proof records without explicit status", () => {
        const parsed = TimelineItemSchema.parse({
            ...baseEncryptedItem,
            versionHistory: [{
                version: 1,
                snapshot: baseEncryptedItem,
                proofHistory: [{
                    version: 1,
                    hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    blockNumber: "44",
                    anchoredAt: "2026-03-10T11:00:00.000Z",
                }],
            }],
        }) as any;

        expect(parsed.versionHistory[0].proofHistory[0].status).toBe("CONFIRMED");
    });

    it("derives SUBMITTED for legacy proof records that only persisted submittedTxHash", () => {
        const parsed = TimelineItemSchema.parse({
            ...baseEncryptedItem,
            versionHistory: [{
                version: 1,
                snapshot: baseEncryptedItem,
                proofHistory: [{
                    version: 1,
                    hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    submittedTxHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    lastAttemptAt: "2026-03-10T11:00:00.000Z",
                }],
            }],
        }) as any;

        expect(parsed.versionHistory[0].proofHistory[0].status).toBe("SUBMITTED");
    });
});
