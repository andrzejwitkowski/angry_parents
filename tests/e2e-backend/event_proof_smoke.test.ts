import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { TestApi } from "./utils/api";
import { acquireE2ETestMutex, ensureTestBackend, releaseE2ETestMutex, TEST_API_URL } from "./utils/ensure";

const nativeFetch = Bun.fetch.bind(Bun);
const BASE_URL = process.env.API_URL || TEST_API_URL;

function createIdempotencyKey(seed: string) {
    return `e2e-${seed}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function waitForProofStatus(api: TestApi, eventId: string, expectedStatus: string, timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const response = await api.get(`/api/events/${eventId}/proof`);
        if (response.status === 200) {
            const proof = await response.json();
            if (proof.status === "FAILED") {
                throw new Error(`Proof ${eventId} failed: ${JSON.stringify(proof)}`);
            }
            if (proof.status === expectedStatus) {
                return proof;
            }
        }

        await Bun.sleep(200);
    }

    throw new Error(`Timed out waiting for proof ${eventId} to reach status ${expectedStatus}`);
}

async function waitForAnyProofStatus(api: TestApi, eventId: string, expectedStatuses: string[], timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const response = await api.get(`/api/events/${eventId}/proof`);
        if (response.status === 200) {
            const proof = await response.json();
            if (proof.status === "FAILED") {
                throw new Error(`Proof ${eventId} failed: ${JSON.stringify(proof)}`);
            }
            if (expectedStatuses.includes(proof.status)) {
                return proof;
            }
        }

        await Bun.sleep(200);
    }

    throw new Error(`Timed out waiting for proof ${eventId} to reach one of statuses: ${expectedStatuses.join(", ")}`);
}

describe.skipIf(!process.env.E2E_TEST)("Event proof smoke e2e", () => {
    const api = new TestApi(BASE_URL);

    beforeAll(async () => {
        await ensureTestBackend();
        // @ts-ignore
        globalThis.fetch = nativeFetch;
    }, 30000);

    beforeEach(async () => {
        await acquireE2ETestMutex();
        api.resetCookies();
        await api.delete("/api/test/database");

        const email = `proof_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
        const registerRes = await api.post("/api/auth/mock-register", {
            email,
            name: "Proof Parent",
            gender: "dad"
        });
        expect(registerRes.status).toBe(200);
    }, 15000);

    afterEach(() => {
        releaseE2ETestMutex();
    });

    test("GET /api/events/:id/proof returns 200 for an existing anchored event", async () => {
        const childRes = await api.post("/api/children", {
            name: "Proof Child",
            icon: "star",
            color: "blue"
        });
        if (childRes.status !== 200) {
            console.log("[event_proof_smoke] child create failed", childRes.status, await childRes.text());
        }
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
            keyId: "test-key-id",
            idempotencyKey: createIdempotencyKey("proof-smoke-anchor")
        });
        if (createRes.status !== 200) {
            console.log("[event_proof_smoke] timeline create failed", createRes.status, await createRes.text());
        }
        expect(createRes.status).toBe(200);
        const event = await createRes.json();

        const publishRes = await api.post("/api/test/events/publish-proof", {
            id: event.id
        });
        expect(publishRes.status).toBe(200);

        const firstProof = await waitForAnyProofStatus(api, event.id, ["SUBMITTED", "CONFIRMED"]);
        const proof = firstProof.status === "CONFIRMED"
            ? firstProof
            : await waitForProofStatus(api, event.id, "CONFIRMED");

        expect(proof.txHash).toMatch(/^0x[0-9a-f]+$/);
        expect(typeof proof.blockNumber).toBe("string");
        expect(proof.blockNumber).toMatch(/^\d+$/);
        expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    test("delayed receipt recovery confirms a submitted proof without duplicate publication", async () => {
        const baselineStatsRes = await api.get("/api/test/events/blockchain-stats");
        expect(baselineStatsRes.status).toBe(200);
        const { submitCount: baselineSubmitCount } = await baselineStatsRes.json();

        const childRes = await api.post("/api/children", {
            name: "Delayed Receipt Child",
            icon: "star",
            color: "green"
        });
        if (childRes.status !== 200) {
            console.log("[event_proof_smoke] delayed child create failed", childRes.status, await childRes.text());
        }
        expect(childRes.status).toBe(200);
        const child = await childRes.json();

        const delayRes = await api.post("/api/test/events/delay-receipt", {});
        expect(delayRes.status).toBe(200);

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
            keyId: "test-key-id",
            idempotencyKey: createIdempotencyKey("proof-smoke-delayed-receipt")
        });
        expect(createRes.status).toBe(200);
        const event = await createRes.json();

        const firstProof = await waitForAnyProofStatus(api, event.id, ["SUBMITTED", "CONFIRMED"]);
        expect(firstProof.submittedTxHash ?? firstProof.txHash).toMatch(/^0x[0-9a-f]+$/);

        if (firstProof.status === "SUBMITTED") {
            expect(firstProof).toMatchObject({
                status: "SUBMITTED",
                submittedTxHash: expect.stringMatching(/^0x[0-9a-f]+$/),
            });
            expect(firstProof.txHash).toBeUndefined();
        }

        const firstStatsRes = await api.get("/api/test/events/blockchain-stats");
        expect(firstStatsRes.status).toBe(200);
        expect(await firstStatsRes.json()).toEqual({ submitCount: baselineSubmitCount + 1 });

        const proof = firstProof.status === "CONFIRMED"
            ? firstProof
            : await waitForProofStatus(api, event.id, "CONFIRMED");

        expect(proof.status).toBe("CONFIRMED");
        expect(proof.txHash).toMatch(/^0x[0-9a-f]+$/);
        expect(typeof proof.blockNumber).toBe("string");

        const secondStatsRes = await api.get("/api/test/events/blockchain-stats");
        expect(secondStatsRes.status).toBe(200);
        expect(await secondStatsRes.json()).toEqual({ submitCount: baselineSubmitCount + 1 });
    }, 30000);

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
