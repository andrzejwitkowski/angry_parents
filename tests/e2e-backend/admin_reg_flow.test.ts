import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { TestApi } from "./utils/api";

const nativeFetch = Bun.fetch.bind(Bun);

const BASE_URL = process.env.API_URL || "http://localhost:3000";

describe("Admin-Initiated Registration Flow E2E", () => {
    let apiAdmin: TestApi;
    let apiDad: TestApi;
    let apiMom: TestApi;

    beforeAll(async () => {
        apiAdmin = new TestApi(BASE_URL);
        apiDad = new TestApi(BASE_URL);
        apiMom = new TestApi(BASE_URL);
        // @ts-ignore
        globalThis.fetch = nativeFetch;

        console.log("Resetting DB...");
        await apiAdmin.delete("/api/test/database");
    });

    afterAll(() => {
        console.log("Admin registration flow E2E tests completed");
    });

    test("Full flow: Admin -> Parent A -> Parent B", async () => {
        // 1. Admin starts registration
        const dadEmail = `dad_${Date.now()}@test.com`;
        const momEmail = `mom_${Date.now()}@test.com`;
        const familyName = "Test Family";

        const startRes = await apiAdmin.post("/api/admin/registrations/start", {
            dadEmail,
            momEmail,
            familyName
        });

        expect(startRes.status).toBe(200);
        const startJson = await startRes.json();
        expect(startJson.dadToken).toBeDefined();
        expect(startJson.momToken).toBeDefined();
        expect(startJson.familyId).toBeDefined();

        const dadToken = startJson.dadToken;
        const momToken = startJson.momToken;
        const familyId = startJson.familyId;

        // 2. Parent A (Dad) registers
        const dadRegRes = await apiDad.post("/api/auth/mock-register", {
            email: dadEmail,
            name: "Dad Name",
            gender: "dad",
            token: dadToken
        });

        expect(dadRegRes.status).toBe(200);
        const dadRegJson = await dadRegRes.json();
        expect(dadRegJson.verified).toBe(true);
        expect(dadRegJson.role).toBe("dad");

        // 3. Admin checks progress
        const statusRes = await apiAdmin.get(`/api/admin/registrations/${startJson._id}`);
        expect(statusRes.status).toBe(200);
        const statusJson = await statusRes.json();
        expect(statusJson.dadStatus).toBe("REGISTERED");
        expect(statusJson.momStatus).toBe("INVITATION_SENT");
        expect(statusJson.status).toBe("FLOW_STARTED");

        // 4. Parent B (Mom) registers
        const momRegRes = await apiMom.post("/api/auth/mock-register", {
            email: momEmail,
            name: "Mom Name",
            gender: "mom",
            token: momToken
        });

        expect(momRegRes.status).toBe(200);
        const momRegJson = await momRegRes.json();
        expect(momRegJson.verified).toBe(true);
        expect(momRegJson.role).toBe("mom");

        // 5. Final Verification
        const finalStatusRes = await apiAdmin.get(`/api/admin/registrations/${startJson._id}`);
        const finalStatusJson = await finalStatusRes.json();
        expect(finalStatusJson.dadStatus).toBe("REGISTERED");
        expect(finalStatusJson.momStatus).toBe("REGISTERED");
        expect(finalStatusJson.status).toBe("COMPLETED");

        // 6. Verify they both share same familyId and can access /me
        const dadMeRes = await apiDad.get("/api/auth/me");
        expect(dadMeRes.status).toBe(200);
        const dadMe = await dadMeRes.json();
        expect(dadMe.user.familyId).toBe(familyId);
        expect(dadMe.user.gender).toBe("dad");

        const momMeRes = await apiMom.get("/api/auth/me");
        expect(momMeRes.status).toBe(200);
        const momMe = await momMeRes.json();
        expect(momMe.user.familyId).toBe(familyId);
        expect(momMe.user.gender).toBe("mom");
    });

    test("Legacy registration without token should fail", async () => {
        const res = await apiDad.post("/api/auth/mock-register", {
            email: "orphan@test.com",
            name: "Orphan Parent",
            gender: "dad"
            // token missing
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.message).toContain("Registration token is required");
    });
});
