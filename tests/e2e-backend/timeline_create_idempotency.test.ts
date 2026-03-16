import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ensureTestBackend } from "./utils/ensure";
import { TestApi } from "./utils/api";

const nativeFetch = Bun.fetch.bind(Bun);

describe.skipIf(!process.env.E2E_TEST)("timeline create idempotency", () => {
    const api = new TestApi(process.env.API_URL || "http://127.0.0.1:3002");

    beforeEach(async () => {
        await ensureTestBackend();
        globalThis.fetch = nativeFetch;

        await api.delete("/api/test/database");

        await api.post("/api/test/dev/seed-mock-family", {});
        await api.post("/api/auth/mock-login", { userId: "mock-user-id-dev-test-stable" });
    });

    afterEach(async () => {
        await api.post("/api/test/outbox/enable", {});
    });

    test("replaying POST /api/timeline with the same idempotencyKey returns the same item", async () => {
        const childRes = await api.post("/api/children", {
            name: "Idempotent Child",
            icon: "star",
            color: "green"
        });
        expect(childRes.status).toBe(200);
        const child = await childRes.json();

        const payload = {
            type: "NOTE",
            date: "2026-03-10",
            childId: child.id,
            encryption: "ENCRYPTED",
            encryptedPayload: {
                "mock-user-id-dev-test-stable": "ciphertext-1"
            },
            signatureBase64: "sig",
            timestamp: "2026-03-10T10:00:00.000Z",
            keyId: "a2V5MQ",
            idempotencyKey: "timeline-create-idem-1"
        };

        const firstRes = await api.post("/api/timeline", payload);
        expect(firstRes.status).toBe(200);
        const first = await firstRes.json();
        expect(first).toMatchObject({
            type: "NOTE",
            date: "2026-03-10",
        });
        expect(first.id).toBeTruthy();

        const secondRes = await api.post("/api/timeline", payload);
        expect(secondRes.status).toBe(200);
        const second = await secondRes.json();
        expect(second).toMatchObject({
            type: "NOTE",
            date: "2026-03-10",
        });
        expect(second.id).toBeTruthy();

        expect(second.id).toBe(first.id);
    });

    test("committed create survives delayed outbox dispatch and later schedules work", async () => {
        const disableRes = await api.post("/api/test/outbox/disable", {});
        expect(disableRes.status).toBe(200);

        const childRes = await api.post("/api/children", {
            name: "Outbox Child",
            icon: "star",
            color: "blue"
        });
        expect(childRes.status).toBe(200);
        const child = await childRes.json();

        const createRes = await api.post("/api/timeline", {
            type: "NOTE",
            date: "2026-03-11",
            childId: child.id,
            encryption: "ENCRYPTED",
            encryptedPayload: {
                "mock-user-id-dev-test-stable": "ciphertext-2"
            },
            signatureBase64: "sig",
            timestamp: "2026-03-11T10:00:00.000Z",
            keyId: "a2V5MQ",
            idempotencyKey: "timeline-create-idem-2"
        });
        expect(createRes.status).toBe(200);

        const enableRes = await api.post("/api/test/outbox/enable", {});
        expect(enableRes.status).toBe(200);

        const flushRes = await api.post("/api/test/process-outbox", {});
        expect(flushRes.status).toBe(200);
        expect(await flushRes.json()).toEqual({ status: "processed", dispatched: true });

        const processRes = await api.post("/api/test/process-tasks", {});
        expect(processRes.status).toBe(200);
        expect(await processRes.json()).toEqual({ status: "processed", count: 1 });
    });
});
