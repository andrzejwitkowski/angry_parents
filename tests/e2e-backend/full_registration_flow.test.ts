import { describe, test, expect, beforeAll } from "bun:test";
import { TestApi } from "./utils/api";

const nativeFetch = Bun.fetch.bind(Bun);
const BASE_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Full Two-Parent Registration Flow
 *
 * A single connected scenario that walks through the complete registration
 * journey from both parents' perspectives, verifying:
 *  - Each parent gets a valid session after registering
 *  - Both parents have populated profile data on /me
 *  - Both parents share the same familyId (same family unit)
 *  - Sessions are fully independent (one logout doesn't affect the other)
 */
describe("Full Two-Parent Registration Flow", () => {
    let apiA: TestApi;
    let apiB: TestApi;

    const emailA = `parentA_full_${Date.now()}@test.com`;
    const emailB = `parentB_full_${Date.now()}@test.com`;

    let inviteToken: string;
    let familyIdA: string;
    let familyIdB: string;

    beforeAll(async () => {
        apiA = new TestApi(BASE_URL);
        apiB = new TestApi(BASE_URL);
        // @ts-ignore
        globalThis.fetch = nativeFetch;

        console.log("[FullFlow] Resetting DB...");
        await apiA.delete("/api/test/database");
    });

    // ──────────────────────────────────────────────────
    // Step 1 & 2: Parent A registers and checks profile
    // ──────────────────────────────────────────────────

    test("Step 1 – Parent A registers successfully", async () => {
        const res = await apiA.post("/api/auth/mock-register-a", {
            email: emailA,
            name: "Test Dad",
            gender: "dad",
        });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.verified).toBe(true);
        expect(json.role).toBe("parent_a");

        const cookie = res.headers.get("Set-Cookie");
        expect(cookie).toContain("token=");
    });

    test("Step 2 – Parent A can access /me and has a familyId", async () => {
        const res = await apiA.get("/api/auth/me");

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.user).toBeDefined();
        expect(json.user.gender).toBe("dad");
        expect(json.user.familyId).toBeTruthy();

        familyIdA = json.user.familyId;
        console.log("[FullFlow] Parent A familyId:", familyIdA);
    });

    // ──────────────────────────────────────────────────
    // Step 3: Parent A invites Parent B
    // ──────────────────────────────────────────────────

    test("Step 3 – Parent A sends invitation to Parent B", async () => {
        const res = await apiA.post("/api/auth/invite", { email: emailB });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.token).toBeDefined();
        expect(json.link).toContain("/register?token=");

        inviteToken = json.token;
        console.log("[FullFlow] Invite token:", inviteToken);
    });

    // ──────────────────────────────────────────────────
    // Step 4: Gender validation on the invite
    // ──────────────────────────────────────────────────

    test("Step 4 – Parent B cannot register with the same gender as Parent A", async () => {
        const res = await apiB.post("/api/auth/mock-register-b", {
            token: inviteToken,
            gender: "dad", // same as Parent A → should fail
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        // Error message should say they need to be the opposite gender
        expect(json.message).toContain("mamą");
    });

    // ──────────────────────────────────────────────────
    // Step 5 & 6: Parent B registers and checks profile
    // ──────────────────────────────────────────────────

    test("Step 5 – Parent B registers successfully with opposite gender", async () => {
        const res = await apiB.post("/api/auth/mock-register-b", {
            token: inviteToken,
            gender: "mom",
        });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.verified).toBe(true);
        expect(json.role).toBe("parent_b");

        const cookie = res.headers.get("Set-Cookie");
        expect(cookie).toContain("token=");
    });

    test("Step 6 – Parent B can access /me and has a familyId", async () => {
        const res = await apiB.get("/api/auth/me");

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.user).toBeDefined();
        expect(json.user.gender).toBe("mom");
        expect(json.user.familyId).toBeTruthy();

        familyIdB = json.user.familyId;
        console.log("[FullFlow] Parent B familyId:", familyIdB);
    });

    // ──────────────────────────────────────────────────
    // Step 7: Shared family unit
    // ──────────────────────────────────────────────────

    test("Step 7 – Both parents share the same familyId", () => {
        expect(familyIdA).toBeDefined();
        expect(familyIdB).toBeDefined();
        expect(familyIdA).toBe(familyIdB);
        console.log("[FullFlow] ✓ Shared familyId confirmed:", familyIdA);
    });

    // ──────────────────────────────────────────────────
    // Step 8 & 9: Session independence
    // ──────────────────────────────────────────────────

    test("Step 8 – Parent A logs out and can no longer access /me", async () => {
        const logoutRes = await apiA.post("/api/auth/logout", {});
        expect(logoutRes.status).toBe(200);

        const meRes = await apiA.get("/api/auth/me");
        expect(meRes.status).toBe(401);
    });

    test("Step 9 – Parent A's logout does not affect Parent B's session", async () => {
        // Parent B's cookie should still be valid
        const res = await apiB.get("/api/auth/me");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.user.familyId).toBe(familyIdB);
        console.log("[FullFlow] ✓ Parent B session unaffected by Parent A logout");
    });
});
