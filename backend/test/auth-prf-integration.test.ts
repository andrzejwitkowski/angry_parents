import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { Elysia } from "elysia";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Family } from "../src/models/Family";
import { Invitation } from "../src/models/Invitation";
import { createAuthController } from "../src/adapters/primary/AuthController";
import { MongoRegistrationProcessRepository } from "../src/adapters/secondary/MongoRegistrationProcessRepository";

// Mocking simplewebauthn/server
mock.module("@simplewebauthn/server", () => ({
    generateRegistrationOptions: async () => ({
        challenge: "mock-challenge",
        rp: { name: "Test RP", id: "localhost" },
        user: { id: "mock-user", name: "test@example.com", displayName: "Test User" },
        pubKeyCredParams: [],
        extensions: { prf: {} }
    }),
    verifyRegistrationResponse: async () => ({
        verified: true,
        registrationInfo: {
            credential: {
                id: "mock-credential-id",
                publicKey: new Uint8Array([4, 5, 6]),
            },
            credentialID: new Uint8Array([1, 2, 3]),
            credentialPublicKey: new Uint8Array([4, 5, 6]),
            counter: 0,
        }
    }),
    generateAuthenticationOptions: async () => ({
        challenge: "mock-challenge",
        allowCredentials: [],
        extensions: { prf: { eval: { first: "mock-salt" } } }
    }),
    verifyAuthenticationResponse: async () => ({
        verified: true,
        authenticationInfo: {
            newCounter: 1
        }
    })
}));

describe("Auth PRF Integration Flow", () => {
    let app: any;
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);
        await Family.deleteMany({});
        await Invitation.deleteMany({});
        // Clear user collection if it exists
        try { await mongoose.connection.db?.collection("user").deleteMany({}); } catch (e) { }

        const registrationRepo = new MongoRegistrationProcessRepository();
        app = new Elysia().use(createAuthController(registrationRepo));
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await mongod.stop();
    });

    it("should complete a full PRF registration and login flow", async () => {
        const email = "mom@example.com";
        const token = "mock-token";

        // 1. Create Family and Invitation
        const family = await Family.create({
            familyName: "Test Family",
            parentPublicKeys: []
        });

        await Invitation.create({
            email,
            familyId: family._id.toString(),
            targetRole: "mom",
            status: "pending",
            token,
            expiresAt: new Date(Date.now() + 3600000)
        });

        // 2. Registration Options
        const optsRes = await app.handle(
            new Request("http://localhost/register/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name: "Mom", username: "mom", gender: "mom" })
            })
        );
        expect(optsRes.status).toBe(200);

        // 3. Registration Verify
        const verifyRes = await app.handle(
            new Request("http://localhost/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    token,
                    registrationResponse: { id: "mock-credential-id" }, // Mocked response
                    rsaPublicKeyBase64: "mock-public-key",
                    encryptedRsaPrivateKeyBase64: "mock-encrypted-private-key",
                    prfSaltBase64: "mock-salt"
                })
            })
        );
        expect(verifyRes.status).toBe(200);

        // Verify state in DB
        const updatedFamily = await Family.findById(family._id);
        expect(updatedFamily).toBeDefined();
        const parent = updatedFamily?.parentPublicKeys.find((p: any) => p.role === "mom");
        expect(parent?.rsaPublicKeyBase64).toBe("mock-public-key");
        expect(parent?.encryptedRsaPrivateKeyBase64).toBe("mock-encrypted-private-key");
        expect(parent?.prfSaltBase64).toBe("mock-salt");

        const actualUserId = updatedFamily?.parentIds[0];
        expect(actualUserId).toBeDefined();

        // The registration created a user in BetterAuth. 
        // We need to ensure that user has the right webauthnCredentialId for the login step.
        // Since we mocked createBetterAuthUser, it returned { userId: "user-123", ... }.
        // Let's manually ensure this user exists in the "user" collection with the right credential ID.
        await mongoose.connection.db?.collection("user").insertOne({
            id: actualUserId,
            email,
            name: "Mom",
            webauthnCredentialId: "mock-credential-id"
        });

        // 4. Login Options
        const loginOptsRes = await app.handle(
            new Request("http://localhost/login/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })
        );
        const loginOptsData = await loginOptsRes.json();
        expect(loginOptsRes.status).toBe(200);
        expect(loginOptsData.extensions?.prf?.eval?.first).toBe("mock-salt");

        // 5. Login Verify
        const loginVerifyRes = await app.handle(
            new Request("http://localhost/login/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    authenticationResponse: {
                        id: "mock-credential-id",
                        clientExtensionResults: {
                            prf: { results: { first: "derived-key" } }
                        }
                    }
                })
            })
        );
        const loginVerifyData = await loginVerifyRes.json();
        expect(loginVerifyRes.status).toBe(200);
        expect(loginVerifyData.encryptedRsaPrivateKeyBase64).toBe("mock-encrypted-private-key");
        expect(loginVerifyData.prfSaltBase64).toBe("mock-salt");
    });
});
