import { describe, test, expect, beforeAll } from "bun:test";
import { TestApi } from "./utils/api";
import { ensureTestBackend, TEST_API_URL } from "./utils/ensure";

const nativeFetch = Bun.fetch.bind(Bun);
const BASE_URL = process.env.API_URL || TEST_API_URL;

/**
 * Full Admin-Initiated Two-Parent Registration Flow with Email Tracking (Symmetrical)
 *
 * This test walks through the complete registration journey:
 *  1. Admin starts registration (both Dad and Mom invited)
 *  2. Dad receives email and "opens" it (tracking token load)
 *  3. Dad registers via token from email
 *  4. Mom receives email and "opens" it (tracking token load)
 *  5. Mom registers via token from email
 *  6. Verification: Both share same familyId, status is COMPLETED
 */
describe.skipIf(!process.env.E2E_TEST)("Admin-Initiated Full Registration Flow", () => {
    let adminApi: TestApi;
    let dadApi: TestApi;
    let momApi: TestApi;

    const emailDad = `dad_${Date.now()}@test.com`;
    const emailMom = `mom_${Date.now()}@test.com`;
    const familyName = "Symmetrical Family";

    let registrationProcessId: string;
    let dadToken: string;
    let dadTrackingToken: string;
    let momToken: string;
    let momTrackingToken: string;
    let sharedFamilyId: string;

    beforeAll(async () => {
        await ensureTestBackend();
        adminApi = new TestApi(BASE_URL);
        dadApi = new TestApi(BASE_URL);
        momApi = new TestApi(BASE_URL);
        // @ts-ignore
        globalThis.fetch = nativeFetch;

        console.log("[E2E] Resetting DB...");
        await adminApi.delete("/api/test/database");
    });

    // --- PHASE 1: Admin Initiation ---

    test("Step 1: Admin initiates registration", async () => {
        const res = await adminApi.post("/api/admin/registrations/start", {
            familyName: familyName,
            dadEmail: emailDad,
            momEmail: emailMom
        });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json._id).toBeDefined();
        expect(json.dadToken).toBeDefined();
        expect(json.momToken).toBeDefined();
        expect(json.dadTrackingToken).toBeDefined();
        expect(json.momTrackingToken).toBeDefined();
        expect(json.familyId).toBeDefined();

        registrationProcessId = json._id;
        dadToken = json.dadToken;
        momToken = json.momToken;
        dadTrackingToken = json.dadTrackingToken;
        momTrackingToken = json.momTrackingToken;
        sharedFamilyId = json.familyId;

        console.log("[E2E] Admin started process:", registrationProcessId);
    });

    // --- PHASE 2: Dad "Opens" Email ---

    test("Step 2: Parent A opens invitation email (tracking)", async () => {
        // Fetch the image with tracking token
        const res = await nativeFetch(`${BASE_URL}/api/assets/children.jpg?t=${dadTrackingToken}`);
        expect(res.status).toBe(200);

        // Verify registration process timeline updated
        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        const procJson = await procRes.json();

        const openEvent = procJson.timeline.find((e: any) => e.type === "EMAIL_READ");
        expect(openEvent).toBeDefined();
        // Symmetrical flow doesn't change overall status to EMAIL_READ immediately if it's per-parent
        // but dadStatus should be EMAIL_OPENED
        expect(procJson.dadStatus).toBe("EMAIL_OPENED");
        console.log("[E2E] Dad email open recorded.");
    });

    // --- PHASE 3: Dad Registers ---

    test("Step 3: Parent A registers via token", async () => {
        const res = await dadApi.post("/api/auth/mock-register", {
            email: emailDad,
            name: "Dad Tester",
            gender: "dad",
            token: dadToken
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);
        expect(json.role).toBe("dad");

        // Verify family access
        const meRes = await dadApi.get("/api/auth/me");
        const meJson = await meRes.json();
        expect(meJson.user.familyId).toBe(sharedFamilyId);
        console.log("[E2E] Dad registered successfully into family:", sharedFamilyId);
    });

    // --- PHASE 4: Mom "Opens" Email ---

    test("Step 5: Parent B opens invitation email (tracking)", async () => {
        const res = await nativeFetch(`${BASE_URL}/api/assets/children.jpg?t=${momTrackingToken}`);
        expect(res.status).toBe(200);

        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        const procJson = await procRes.json();

        expect(procJson.momStatus).toBe("EMAIL_OPENED");
        console.log("[E2E] Mom email open recorded.");
    });

    // --- PHASE 5: Mom Registers ---

    test("Step 6: Parent B registers via token", async () => {
        const res = await momApi.post("/api/auth/mock-register", {
            email: emailMom,
            name: "Mom Tester",
            gender: "mom",
            token: momToken
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);
        expect(json.role).toBe("mom");

        const meRes = await momApi.get("/api/auth/me");
        const meJson = await meRes.json();
        expect(meJson.user.familyId).toBe(sharedFamilyId);
        console.log("[E2E] Mom registered successfully into family:", sharedFamilyId);
    });

    // --- PHASE 6: Final Verification ---

    test("Step 7: Final registration process status is COMPLETED", async () => {
        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        const procJson = await procRes.json();

        expect(procJson.status).toBe("COMPLETED");
        const completedEvent = procJson.timeline.find((e: any) => e.type === "COMPLETED");
        expect(completedEvent).toBeDefined();
        console.log("[E2E] Full registration process verified as COMPLETED.");
    });
});
