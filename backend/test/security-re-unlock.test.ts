import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { Elysia } from "elysia";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.SUPPRESS_JEST_WARNINGS = "true";

const mongoose = (await import("mongoose")).default;
const { Family } = await import("../src/adapters/mongo/models/FamilyModel");
const { createAuthController } = await import("../src/adapters/rest/auth/AuthController");
const { MongoRegistrationProcessRepository } = await import("../src/adapters/mongo/repositories/auth/MongoRegistrationProcessRepository");

// Mocking simplewebauthn/server
mock.module("@simplewebauthn/server", () => ({
    generateAuthenticationOptions: async (options: any) => ({
        challenge: "mock-challenge",
        allowCredentials: [{ id: "mock-credential-id", type: "public-key" }],
        extensions: options.extensions?.prf ? { prf: { eval: options.extensions.prf.eval } } : undefined
    }),
    verifyAuthenticationResponse: async () => ({
        verified: true,
        authenticationInfo: {
            newCounter: 1
        }
    })
}));

describe("Security Re-Unlock Integration", () => {
    let app: any;
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);

        const registrationRepo = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
        app = new Elysia().use(createAuthController(registrationRepo));
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await mongod.stop();
    });

    it("should allow a registered user to re-authenticate and receive E2EE keys (Unlock flow)", async () => {
        const email = "user@example.com";
        const userId = "user-123";
        const familyId = new mongoose.Types.ObjectId();

        // 1. Setup existing user and family in DB
        await Family.create({
            _id: familyId,
            name: "Test Family",
            parentIds: [userId],
            parentPublicKeys: [{
                parentId: userId,
                role: "dad",
                rsaPublicKeyBase64: "stored-pub-key",
                encryptedRsaPrivateKeyBase64: "stored-encrypted-priv-key",
                prfSaltBase64: "c2FsdC0xMjM0"
            }]
        });

        await mongoose.connection.db?.collection("user").insertOne({
            id: userId,
            email,
            name: "Dad",
            familyId: familyId.toString(),
            webauthnCredentialId: "mock-credential-id",
            webauthnPublicKey: "mock-pubkey-b64",
            webauthnCounter: 0
        });

        // 2. Request Login Options (should include PRF extension)
        const loginOptsRes = await app.handle(
            new Request("http://localhost/login/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })
        );
        expect(loginOptsRes.status).toBe(200);
        const loginOptsData = await loginOptsRes.json();
        expect(loginOptsData.extensions?.prf?.eval?.first).toBe("c2FsdC0xMjM0");

        // 3. Verify Authentication (should return encrypted keys)
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
        expect(loginVerifyRes.status).toBe(200);
        const loginVerifyData = await loginVerifyRes.json();

        expect(loginVerifyData.encryptedRsaPrivateKeyBase64).toBe("stored-encrypted-priv-key");
        expect(loginVerifyData.prfSaltBase64).toBe("c2FsdC0xMjM0");
        expect(loginVerifyData.userId).toBe(userId);
        expect(loginVerifyData.token).toBeUndefined();
    });
});
