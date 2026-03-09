import { describe, expect, it, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { createAuthController } from "../src/adapters/rest/auth/AuthController";
import { createChildController } from "../src/adapters/rest/family/ChildController";
import { Family } from "../src/adapters/mongo/models/FamilyModel";
import { Invitation } from "../src/adapters/mongo/models/InvitationModel";
import { MongoRegistrationProcessRepository } from "../src/adapters/mongo/repositories/auth/MongoRegistrationProcessRepository";
import { MongoChildRepository } from "../src/adapters/mongo/repositories/family/MongoChildRepository";
import { ChildService } from "../src/domain/family/service/ChildService";
import { FamilyApiService } from "../src/domain/family/service/FamilyApiService";
import { InMemoryTimelineRepository } from "../src/adapters/mongo/inmemory/events/InMemoryTimelineRepository";
import { RealUuidProvider } from "../src/shared/providers/RealUuidProvider";
import { signJwt } from "../src/lib/jwt";
import mongoose from "mongoose";
import { Elysia } from "elysia";
import { ensureMongo } from "./utils/ensureMongo";

// Mock BetterAuth
mock.module("../src/lib/auth", () => ({
    auth: {
        api: {
            signUpEmail: async () => ({ user: { id: "mock-user-id", email: "mock@test.com", name: "Mock" } }),
            updateUser: async () => ({})
        }
    }
}));

describe.skipIf(!process.env.INTEGRATION_TEST)("Auth Controller Integration", () => {
    let app: any;
    let repo: MongoRegistrationProcessRepository;
    const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/angry_parents_test_auth_integration";

    beforeAll(async () => {
        await ensureMongo(TEST_DB_URI);
        await mongoose.connect(TEST_DB_URI);
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await Family.deleteMany({});
        await Invitation.deleteMany({});
        if (mongoose.connection.db) {
            repo = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
            const authController = createAuthController(repo);
            const childRepository = new MongoChildRepository();
            const childService = new ChildService(childRepository, new InMemoryTimelineRepository(), new RealUuidProvider());
            const familyApiService = new FamilyApiService(childService);
            const childController = createChildController(familyApiService);
            app = new Elysia()
                .group("/api/auth", (group) => group.use(authController))
                .use(childController);

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

        it("should return the same children as /api/children for the current family", async () => {
            const familyId = new mongoose.Types.ObjectId().toString();
            await Family.create({
                _id: familyId,
                name: "Family One",
                parentIds: ["user-1"],
                parentPublicKeys: [],
                children: [
                    { id: "child-1", name: "dziecko 1", icon: "user", color: "#FFC0CB" },
                    { id: "child-2", name: "dziecko 2", icon: "user", color: "#302843" }
                ],
                custodyPatterns: []
            });

            const token = await signJwt({ userId: "user-1", role: "dad", gender: "dad", familyId });

            const meResponse = await app.handle(new Request("http://localhost/api/auth/me", {
                headers: { Cookie: `token=${token}` }
            }));
            const childrenResponse = await app.handle(new Request("http://localhost/api/children", {
                headers: { Cookie: `token=${token}` }
            }));

            expect(meResponse.status).toBe(200);
            expect(childrenResponse.status).toBe(200);

            const meJson = await meResponse.json() as { family: { children: Array<{ id: string; name: string }> } };
            const childrenJson = await childrenResponse.json() as Array<{ id: string; name: string }>;

            expect(meJson.family.children).toEqual(childrenJson);
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
        it("should register a user WITHOUT token (creates own family)", async () => {
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

            expect(response.status).toBe(200);
            const json = await response.json() as { verified: boolean; role: string };
            expect(json.verified).toBe(true);
            expect(json.role).toBe("dad");
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

        it("should reject invalid invitation token", async () => {
            const response = await app.handle(
                new Request("http://localhost/api/auth/mock-register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: "test@example.com",
                        name: "Test User",
                        gender: "dad",
                        token: "invalid-token"
                    }),
                })
            );

            expect(response.status).toBe(400);
            const json = await response.json() as { message: string };
            expect(json.message).toBe("Invalid or expired invitation token");
        });
    });
});

