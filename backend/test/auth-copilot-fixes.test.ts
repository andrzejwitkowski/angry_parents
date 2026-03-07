import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Family } from "../src/models/Family";
import { Invitation } from "../src/models/Invitation";
import { createAuthController } from "../src/adapters/primary/AuthController";
import { MongoRegistrationProcessRepository } from "../src/adapters/secondary/MongoRegistrationProcessRepository";
import { signJwt } from "../src/lib/jwt";

let failAuthenticationVerification = false;

mock.module("@simplewebauthn/server", () => ({
    generateRegistrationOptions: async () => ({
        challenge: "mock-challenge",
        rp: { name: "Test RP", id: "localhost" },
        user: { id: "mock-user", name: "test@example.com", displayName: "Test User" },
        pubKeyCredParams: [],
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
    generateAuthenticationOptions: async (options: any) => ({
        challenge: "mock-challenge",
        allowCredentials: [{ id: "AQID", type: "public-key" }],
        extensions: options.extensions?.prf ? { prf: { eval: options.extensions.prf.eval } } : undefined
    }),
    verifyAuthenticationResponse: async () => {
        if (failAuthenticationVerification) {
            throw new Error("forced WebAuthn verification failure");
        }
        return {
            verified: true,
            authenticationInfo: {
                newCounter: 1
            }
        };
    }
}));

describe("AuthController Copilot regression fixes", () => {
    let app: any;
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);

        const registrationRepo = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
        app = new Elysia().use(createAuthController(registrationRepo));
    });

    beforeEach(async () => {
        failAuthenticationVerification = false;
        await Family.deleteMany({});
        await Invitation.deleteMany({});
        await mongoose.connection.db?.collection("user").deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await mongod.stop();
    });

    it("rejects /register/verify in production when encrypted key material is incomplete", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const family = await Family.create({ name: "Family A", parentPublicKeys: [] });
            const token = "token-register-incomplete-material";
            await Invitation.create({
                email: "mom@example.com",
                familyId: family._id.toString(),
                targetRole: "mom",
                status: "pending",
                token,
                expiresAt: new Date(Date.now() + 3_600_000)
            });

            const response = await app.handle(new Request("http://localhost/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    tempEmail: "mom@example.com",
                    registrationResponse: { id: "mock-credential-id" },
                    rsaPublicKeyBase64: "mock-public-key"
                })
            }));

            const json = await response.json();
            expect(response.status).toBe(400);
            expect(String(json.message || "")).toContain("encryptedRsaPrivateKeyBase64");
            expect(String(json.message || "")).toContain("prfSaltBase64");

            const invitation = await Invitation.findOne({ token });
            expect(invitation?.status).toBe("pending");
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });

    it("uses session JWT context before email lookup when building PRF options", async () => {
        const userId = "user-session-first";
        const familyId = new mongoose.Types.ObjectId();

        await Family.create({
            _id: familyId,
            name: "Family Session First",
            parentIds: [userId],
            parentPublicKeys: [{
                parentId: userId,
                role: "dad",
                rsaPublicKeyBase64: "stored-pub-key",
                encryptedRsaPrivateKeyBase64: "stored-encrypted-priv-key",
                prfSaltBase64: "c2FsdC0xMjM0"
            }]
        });

        const token = await signJwt({
            userId,
            familyId: familyId.toString(),
            role: "dad",
            gender: "dad"
        });

        const response = await app.handle(new Request("http://localhost/login/options", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": `token=${token}`
            },
            body: JSON.stringify({
                email: "synthetic-user@example.com"
            })
        }));

        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.extensions?.prf?.eval?.first).toBe("c2FsdC0xMjM0");
    });

    it("fails closed in production when WebAuthn verification throws", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        failAuthenticationVerification = true;

        try {
            const email = "prod-user@example.com";
            const userId = "prod-user-1";
            const familyId = new mongoose.Types.ObjectId();

            await Family.create({
                _id: familyId,
                name: "Family Fail Closed",
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
                webauthnCredentialId: "AQID",
                webauthnPublicKey: "AQID",
                webauthnCounter: 0
            });

            const optionsResponse = await app.handle(new Request("http://localhost/login/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            }));
            expect(optionsResponse.status).toBe(200);

            const verifyResponse = await app.handle(new Request("http://localhost/login/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    authenticationResponse: { id: "AQID" }
                })
            }));

            const verifyJson = await verifyResponse.json();
            expect(verifyResponse.status).toBe(401);
            expect(verifyJson.verified).toBe(false);
        } finally {
            process.env.NODE_ENV = previousEnv;
            failAuthenticationVerification = false;
        }
    });
});
