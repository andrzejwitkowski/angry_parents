import { describe, test, expect, beforeAll } from "bun:test";
import { TestApi } from "./utils/api";

const nativeFetch = Bun.fetch.bind(Bun);
const BASE_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Full Admin-Initiated Two-Parent Registration Flow with Email Tracking
 *
 * This test walks through the complete registration journey:
 *  1. Admin starts registration (family unit created)
 *  2. Parent A receives email and "opens" it (tracking token load)
 *  3. Parent A registers via token from email
 *  4. Parent A invites Parent B
 *  5. Parent B receives email and "opens" it (tracking token load)
 *  6. Parent B registers via token from email
 *  7. Verification: Both share same familyId, timeline is complete
 */
describe("Admin-Initiated Full Registration Flow", () => {
    let adminApi: TestApi;
    let parentAApi: TestApi;
    let parentBApi: TestApi;

    const emailA = `parentA_${Date.now()}@test.com`;
    const emailB = `parentB_${Date.now()}@test.com`;
    const familyName = "Testowa Rodzina";

    let registrationProcessId: string;
    let parentAToken: string;
    let parentATrackingToken: string;
    let parentBToken: string;
    let parentBTrackingToken: string;
    let sharedFamilyId: string;

    beforeAll(async () => {
        adminApi = new TestApi(BASE_URL);
        parentAApi = new TestApi(BASE_URL);
        parentBApi = new TestApi(BASE_URL);
        // @ts-ignore
        globalThis.fetch = nativeFetch;

        console.log("[E2E] Resetting DB...");
        await adminApi.delete("/api/test/database");
    });

    // --- PHASE 1: Admin Initiation ---

    test("Step 1: Admin initiates registration", async () => {
        const res = await adminApi.post("/api/admin/registrations/start", {
            parentName: "Tata Test",
            parentEmail: emailA,
            familyName: familyName,
            role: "dad"
        });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json._id).toBeDefined();
        expect(json.token).toBeDefined();
        expect(json.parentATrackingToken).toBeDefined();
        expect(json.familyId).toBeDefined();

        registrationProcessId = json._id;
        parentAToken = json.token;
        parentATrackingToken = json.parentATrackingToken;
        sharedFamilyId = json.familyId;

        console.log("[E2EL] Admin started process:", registrationProcessId);
    });

    // --- PHASE 2: Parent A "Opens" Email ---

    test("Step 2: Parent A opens invitation email (tracking)", async () => {
        // Fetch the image with tracking token
        const res = await nativeFetch(`${BASE_URL}/api/assets/children.jpg?t=${parentATrackingToken}`);
        expect(res.status).toBe(200);

        // Verify registration process timeline updated
        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        if (!procRes.ok) {
            console.error("DEBUG:", await procRes.text());
        }
        const procJson = await procRes.json();

        const openEvent = procJson.timeline.find((e: any) => e.type === "EMAIL_READ" && e.message.includes("Rodzica A"));
        expect(openEvent).toBeDefined();
        expect(procJson.status).toBe("EMAIL_READ");
        console.log("[E2E] Parent A email open recorded.");
    });

    // --- PHASE 3: Parent A Registers ---

    test("Step 3: Parent A registers via token", async () => {
        const res = await parentAApi.post("/api/auth/mock-register-a", {
            email: emailA,
            name: "Tata Test",
            gender: "dad",
            token: parentAToken
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);
        expect(json.role).toBe("parent_a");

        // Verify family access
        const meRes = await parentAApi.get("/api/auth/me");
        const meJson = await meRes.json();
        expect(meJson.user.familyId).toBe(sharedFamilyId);
        console.log("[E2E] Parent A registered successfully into family:", sharedFamilyId);
    });

    // --- PHASE 4: Invitation to Parent B ---

    test("Step 4: Parent A invites Parent B", async () => {
        const res = await parentAApi.post("/api/auth/invite", { email: emailB });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.token).toBeDefined();
        parentBToken = json.token;

        // Get tracking token from the process (since it's internal to back-end response for dev preview, normally we'd get it from email)
        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        if (!procRes.ok) {
            console.error("DEBUG:", await procRes.text());
        }
        const procJson = await procRes.json();
        parentBTrackingToken = procJson.parentBTrackingToken;
        expect(parentBTrackingToken).toBeDefined();

        console.log("[E2E] Parent B invited. Tracking token:", parentBTrackingToken);
    });

    // --- PHASE 5: Parent B "Opens" Email ---

    test("Step 5: Parent B opens invitation email (tracking)", async () => {
        const res = await nativeFetch(`${BASE_URL}/api/assets/children.jpg?t=${parentBTrackingToken}`);
        expect(res.status).toBe(200);

        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        if (!procRes.ok) {
            console.error("DEBUG:", await procRes.text());
        }
        const procJson = await procRes.json();

        const openEvent = procJson.timeline.find((e: any) => e.type === "EMAIL_READ" && e.message.includes("Rodzica B"));
        expect(openEvent).toBeDefined();
        console.log("[E2E] Parent B email open recorded.");
    });

    // --- PHASE 6: Parent B Registers ---

    test("Step 6: Parent B registers via token", async () => {
        const res = await parentBApi.post("/api/auth/mock-register-b", {
            token: parentBToken,
            gender: "mom"
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);

        const meRes = await parentBApi.get("/api/auth/me");
        const meJson = await meRes.json();
        expect(meJson.user.familyId).toBe(sharedFamilyId);
        console.log("[E2E] Parent B registered successfully into family:", sharedFamilyId);
    });

    // --- PHASE 7: Final Verification ---

    test("Step 7: Final registration process status is COMPLETED", async () => {
        const procRes = await adminApi.get(`/api/admin/registrations/${registrationProcessId}`);
        if (!procRes.ok) {
            console.error("DEBUG:", await procRes.text());
        }
        const procJson = await procRes.json();

        expect(procJson.status).toBe("COMPLETED");
        const completedEvent = procJson.timeline.find((e: any) => e.type === "COMPLETED");
        expect(completedEvent).toBeDefined();
        console.log("[E2E] Full registration process verified as COMPLETED.");
    });
});
