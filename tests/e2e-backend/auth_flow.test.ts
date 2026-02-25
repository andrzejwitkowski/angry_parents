import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { TestApi } from "./utils/api";

const nativeFetch = Bun.fetch.bind(Bun);

const BASE_URL = process.env.API_URL || "http://localhost:3000";

describe("Auth Flow E2E", () => {
    let apiA: TestApi;
    let apiB: TestApi;

    beforeAll(async () => {
        apiA = new TestApi(BASE_URL);
        apiB = new TestApi(BASE_URL);
        // @ts-ignore
        globalThis.fetch = nativeFetch;

        console.log("Resetting DB...");
        await apiA.delete("/api/test/database");
    });

    afterAll(() => {
        console.log("Auth E2E tests completed");
    });

    test("Full Parent A Registration", async () => {
        const email = `parentA_${Date.now()}@test.com`;

        const res = await apiA.post("/api/auth/mock-register-a", {
            email,
            name: "Test Parent A",
            gender: "dad",
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);
        expect(json.role).toBe("parent_a");

        const cookie = res.headers.get("Set-Cookie");
        expect(cookie).toContain("token=");
    });

    test("Parent A can invite Parent B", async () => {
        const inviteRes = await apiA.post("/api/auth/invite", {
            email: `parentB_${Date.now()}@test.com`,
        });

        expect(inviteRes.status).toBe(200);
        const inviteJson = await inviteRes.json();
        expect(inviteJson.token).toBeDefined();
        expect(inviteJson.link).toContain("/register?token=");
    });

    test("Parent B cannot register with same gender", async () => {
        const email = `parentB_same_${Date.now()}@test.com`;

        const inviteRes = await apiA.post("/api/auth/invite", {
            email,
        });
        const inviteJson = await inviteRes.json();

        const failRes = await apiB.post("/api/auth/mock-register-b", {
            token: inviteJson.token,
            gender: "dad",
        });

        expect(failRes.status).toBe(400);
        const failJson = await failRes.json();
        expect(failJson.message).toContain("mamą");
    });

    test("Parent B can register with opposite gender", async () => {
        const email = `parentB_opposite_${Date.now()}@test.com`;

        const inviteRes = await apiA.post("/api/auth/invite", {
            email,
        });
        const inviteJson = await inviteRes.json();

        const okRes = await apiB.post("/api/auth/mock-register-b", {
            token: inviteJson.token,
            gender: "mom",
        });

        expect(okRes.status).toBe(200);
        const okJson = await okRes.json();
        expect(okJson.verified).toBe(true);
        expect(okJson.role).toBe("parent_b");

        const cookie = okRes.headers.get("Set-Cookie");
        expect(cookie).toContain("token=");
    });

    test("Dev mock login works", async () => {
        const res = await apiA.post("/api/auth/mock-login", {});

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.verified).toBe(true);

        const cookie = res.headers.get("Set-Cookie");
        expect(cookie).toContain("token=");
    });

    test("Protected endpoint requires auth", async () => {
        await apiA.post("/api/auth/logout", {});
        const res = await apiA.get("/api/auth/me");

        expect(res.status).toBe(401);
    });

    test("Protected endpoint works with cookie", async () => {
        await apiA.post("/api/auth/mock-login", {});

        const res = await apiA.get("/api/auth/me");
        expect(res.status).toBe(200);
    });

    test("Logout clears cookie", async () => {
        await apiA.post("/api/auth/mock-login", {});

        const logoutRes = await apiA.post("/api/auth/logout", {});
        expect(logoutRes.status).toBe(200);

        const cookie = logoutRes.headers.get("Set-Cookie") || "";
        expect(cookie.toLowerCase()).toContain("max-age=0");

        const meRes = await apiA.get("/api/auth/me");
        expect(meRes.status).toBe(401);
    });
});
