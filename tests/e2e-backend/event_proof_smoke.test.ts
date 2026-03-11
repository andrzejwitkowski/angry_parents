import { beforeAll, describe, expect, test } from "bun:test";
import { TestApi } from "./utils/api";
import { ensureTestBackend, TEST_API_URL } from "./utils/ensure";

const nativeFetch = Bun.fetch.bind(Bun);
const BASE_URL = process.env.API_URL || TEST_API_URL;

describe.skipIf(!process.env.E2E_TEST)("Event proof smoke e2e", () => {
    const api = new TestApi(BASE_URL);
    const email = `proof_${Date.now()}@test.com`;

    beforeAll(async () => {
        await ensureTestBackend();
        // @ts-ignore
        globalThis.fetch = nativeFetch;
        await api.delete("/api/test/database");

        const registerRes = await api.post("/api/auth/mock-register", {
            email,
            name: "Proof Parent",
            gender: "dad"
        });
        expect(registerRes.status).toBe(200);
    });

    test("GET /api/events/:id/proof returns 200 for an existing anchored event", async () => {
        const childRes = await api.post("/api/children", {
            name: "Proof Child",
            icon: "star",
            color: "blue"
        });
        expect(childRes.status).toBe(200);
        const child = await childRes.json();

        const createRes = await api.post("/api/timeline", {
            type: "NOTE",
            date: "2026-03-10",
            childId: child.id,
            encryption: "ENCRYPTED",
            encryptedPayload: {
                placeholder: "ciphertext"
            },
            signatureBase64: "test-signature",
            timestamp: new Date().toISOString(),
            keyId: "test-key-id"
        });
        expect(createRes.status).toBe(200);
        const event = await createRes.json();

        const publishRes = await api.post("/api/test/events/publish-proof", {
            id: event.id
        });
        expect(publishRes.status).toBe(200);

        const proofRes = await api.get(`/api/events/${event.id}/proof`);
        expect(proofRes.status).toBe(200);
        const proof = await proofRes.json();

        expect(proof.txHash).toMatch(/^0x[0-9a-f]+$/);
        expect(typeof proof.blockNumber).toBe("string");
        expect(proof.blockNumber).toMatch(/^\d+$/);
        expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test("GET /api/events/:id/proof returns 404 for a nonexistent event", async () => {
        const res = await api.get("/api/events/nonexistent-event/proof");

        expect(res.status).toBe(404);
        const contentType = res.headers.get("content-type") || "";
        expect(contentType).toContain("application/json");
        expect(await res.json()).toEqual({
            error: "Timeline item with id nonexistent-event not found"
        });
    });
});
