import { beforeEach, describe, expect, it, jest, mock } from "bun:test";

mock.module("@/lib/crypto-utils", () => ({
    importPublicKey: jest.fn().mockResolvedValue({}),
    encryptRSA: jest.fn(async (plaintext: string) => `encrypted:${plaintext}`),
    decryptRSA: jest.fn(),
}));

mock.module("@/lib/e2ee-session", () => ({
    getActiveE2eeUserId: jest.fn(),
    getTimelinePrivateKey: jest.fn(),
    clearTimelinePrivateKeyCache: jest.fn(),
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({
            family: {
                parentPublicKeys: [
                    { parentId: "mom-1", rsaPublicKeyBase64: "pub-mom" },
                    { parentId: "dad-1", rsaPublicKeyBase64: "pub-dad" },
                ],
            },
        }),
    },
}));

import { timelineApi } from "./timeline";
import type { MutationSignature } from "../signature-provider";

describe("timelineApi.create", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const fetchMock = mock(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                id: "item-1",
                type: "NOTE",
                date: "2026-03-12",
                createdAt: "2026-03-12T10:00:00.000Z",
                createdBy: "user-1",
                auditTrail: [],
                isDeleted: false,
                childIds: ["child-1"],
                encryption: "ENCRYPTED",
                encryptedPayload: { "mom-1": "cipher", "dad-1": "cipher" },
            }),
        } as Response));
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    it("sends a top-level idempotencyKey and excludes it from encrypted payload", async () => {
        const signature: MutationSignature = {
            signatureBase64: "sig",
            timestamp: "2026-03-12T10:00:00.000Z",
            keyId: "key-1",
        };

        await timelineApi.create({
            type: "NOTE",
            date: "2026-03-12",
            childId: "child-1",
            encryption: "PLAINTEXT",
            content: "hello",
            idempotencyKey: "idem-123",
        }, signature);

        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0];
        const body = JSON.parse(init.body);

        expect(body.idempotencyKey).toBe("idem-123");
        expect(body.encryptedPayload["mom-1"]).toContain('"content":"hello"');
        expect(body.encryptedPayload["mom-1"]).not.toContain("idempotencyKey");
    });

    it("rejects create when caller does not provide a stable idempotencyKey", async () => {
        const signature: MutationSignature = {
            signatureBase64: "sig",
            timestamp: "2026-03-12T10:00:00.000Z",
            keyId: "key-1",
        };

        await expect(timelineApi.create({
            type: "NOTE",
            date: "2026-03-12",
            childId: "child-1",
            encryption: "PLAINTEXT",
            content: "hello",
        }, signature)).rejects.toThrow("Timeline create requires a stable idempotencyKey");

        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
