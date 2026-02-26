import { describe, expect, it, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { createAuthController } from "../src/adapters/primary/AuthController";
import { Family } from "../src/models/Family";
import { Invitation } from "../src/models/Invitation";
import { MongoRegistrationProcessRepository } from "../src/adapters/secondary/MongoRegistrationProcessRepository";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Elysia } from "elysia";

// Mock BetterAuth
mock.module("../src/lib/auth", () => ({
    auth: {
        api: {
            signUpEmail: async () => ({ user: { id: "mock-user-id", email: "mock@test.com", name: "Mock" } }),
            updateUser: async () => ({})
        }
    }
}));

describe("Auth Controller Integration", () => {
    let mongoServer: MongoMemoryServer;
    let app: Elysia;
    let repo: MongoRegistrationProcessRepository;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await Family.deleteMany({});
        await Invitation.deleteMany({});
        if (mongoose.connection.db) {
            repo = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
            const authController = createAuthController(repo);
            app = new Elysia()
                .group("/api/auth", (group) => group.use(authController));

            // Set global app for internal handle calls
            (globalThis as any).app = app;
        }
    });

    describe("GET /me", () => {
        it("should return 401 without token", async () => {
            const response = await app.handle(
                new Request("http://localhost/api/auth/me")
            );

            expect(response.status).toBe(401);
        });
    });

    describe("POST /logout", () => {
        it("should clear cookie", async () => {
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

    describe("POST /mock-register", () => {
        it("should return 400 without token", async () => {
            const response = await app.handle(
                new Request("http://localhost/api/auth/mock-register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: "test@example.com",
                        name: "Test User",
                        gender: "dad",
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it("should register a user with a valid token", async () => {
            // Create a mock family and invitation
            const family = new Family({ parentIds: [], children: [], custodyPatterns: [] });
            await family.save();

            const invitation = new Invitation({
                token: "valid-token-123",
                email: "test@example.com",
                familyId: family._id,
                targetRole: "dad",
                status: "pending",
                expiresAt: new Date(Date.now() + 1000000)
            });
            await invitation.save();

            const response = await app.handle(
                new Request("http://localhost/api/auth/mock-register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: "test@example.com",
                        name: "Test User",
                        gender: "dad",
                        token: "valid-token-123"
                    }),
                })
            );

            expect(response.status).toBe(200);
            const json = await response.json() as { verified: boolean; role: string };
            expect(json.verified).toBe(true);
            expect(json.role).toBe("dad");
        });
    });
});

