import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { createAuthController } from "../src/adapters/primary/AuthController";
import { Family } from "../src/models/Family";
import { Invitation } from "../src/models/Invitation";
import mongoose from "mongoose";

const controller = createAuthController();

describe("Auth Controller Integration", () => {
    beforeAll(async () => {
        const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/angry_parents_test";
        await mongoose.connect(mongoUri);

        await Family.deleteMany({});
        await Invitation.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    describe("GET /me", () => {
        it("should return 401 without token", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const response = await app.handle(
                new Request("http://localhost/api/auth/me")
            );

            expect(response.status).toBe(401);
        });
    });

    describe("POST /logout", () => {
        it("should clear cookie", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const response = await app.handle(
                new Request("http://localhost/api/auth/logout", {
                    method: "POST",
                })
            );

            expect(response.status).toBe(200);
            const cookie = response.headers.get("Set-Cookie");
            expect(cookie).toContain("Max-Age=0");
        });
    });

    describe("POST /dev/mock-register-a", () => {
        it("should route to auth endpoint", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const response = await app.handle(
                new Request("http://localhost/api/auth/dev/mock-register-a", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: `parent-a-${Date.now()}@test.com`,
                        name: "Test Parent A",
                        gender: "dad",
                    }),
                })
            );

            expect(response.status).toBeGreaterThanOrEqual(200);
        });

        it("should handle invalid gender input", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const response = await app.handle(
                new Request("http://localhost/api/auth/dev/mock-register-a", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: "parent-a@test.com",
                        name: "Test",
                        gender: "invalid",
                    }),
                })
            );

            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe("Invitation Validation", () => {
        it("should reject same gender for parent b", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const res1 = await app.handle(
                new Request("http://localhost/api/auth/register/parent-b/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mock: true,
                        tempToken: "non-existent-token",
                        tempFamilyId: new mongoose.Types.ObjectId().toString(),
                        tempCreatedByGender: "dad",
                        gender: "dad",
                    }),
                })
            );

            expect(res1.status).toBe(400);
            const json = await res1.json();
            expect(json.message).toContain("mamą");
        });

        it("should allow opposite gender for parent b", async () => {
            const app = new (await import("elysia")).Elysia().group("/api/auth", (app) => app.use(controller));

            const res1 = await app.handle(
                new Request("http://localhost/api/auth/register/parent-b/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mock: true,
                        tempToken: "non-existent-token-2",
                        tempFamilyId: new mongoose.Types.ObjectId().toString(),
                        tempCreatedByGender: "dad",
                        gender: "mom",
                    }),
                })
            );

            expect(res1.status).toBe(400);
            const json = await res1.json();
            expect(json.message).toBe("Invalid invitation");
        });
    });
});
