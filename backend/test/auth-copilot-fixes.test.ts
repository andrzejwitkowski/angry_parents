import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Family } from "../src/adapters/mongo/models/FamilyModel";
import { Invitation } from "../src/adapters/mongo/models/InvitationModel";
import { createAuthController } from "../src/adapters/rest/auth/AuthController";
import { MongoRegistrationProcessRepository } from "../src/adapters/mongo/repositories/auth/MongoRegistrationProcessRepository";
import { signJwt } from "../src/lib/jwt";

let failAuthenticationVerification = false;
let failRegistrationVerification = false;

mock.module("@simplewebauthn/server", () => ({
    generateRegistrationOptions: async () => ({
        challenge: "mock-challenge",
        rp: { name: "Test RP", id: "localhost" },
        user: { id: "mock-user", name: "test@example.com", displayName: "Test User" },
        pubKeyCredParams: [],
    }),
    verifyRegistrationResponse: async () => {
        if (failRegistrationVerification) {
            return {
                verified: false,
                registrationInfo: undefined,
            };
        }

        return {
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
        };
    },
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
        failRegistrationVerification = false;
        await Family.deleteMany({});
        await Invitation.deleteMany({});
        await mongoose.connection.db?.collection("user").deleteMany({});
        await mongoose.connection.db?.collection("auth_challenges").deleteMany({});
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
        expect(response.headers.get("content-type") || "").toContain("application/json");
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

    it("rejects /register/verify in production when key material is not valid base64", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const family = await Family.create({ name: "Family Invalid Key Material", parentPublicKeys: [] });
            const token = "token-register-invalid-material";
            await Invitation.create({
                email: "dad@example.com",
                familyId: family._id.toString(),
                targetRole: "dad",
                status: "pending",
                token,
                expiresAt: new Date(Date.now() + 3_600_000)
            });

            const response = await app.handle(new Request("http://localhost/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    tempEmail: "dad@example.com",
                    registrationResponse: { id: "mock-credential-id" },
                    rsaPublicKeyBase64: "not-base64!!!",
                    encryptedRsaPrivateKeyBase64: "still-not-base64***",
                    prfSaltBase64: "bad$$$"
                })
            }));

            const json = await response.json();
            expect(response.status).toBe(400);
            expect(String(json.message || "")).toContain("Invalid key material");
            expect(String(json.message || "")).toContain("rsaPublicKeyBase64");
            expect(String(json.message || "")).toContain("encryptedRsaPrivateKeyBase64");
            expect(String(json.message || "")).toContain("prfSaltBase64");
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });

    it("consumes registration challenge even when verification fails", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const family = await Family.create({ name: "Family Registration Challenge", parentPublicKeys: [] });
            const token = "token-register-challenge-consume";
            const email = "challenge-reg@example.com";

            await Invitation.create({
                email,
                familyId: family._id.toString(),
                targetRole: "mom",
                status: "pending",
                token,
                expiresAt: new Date(Date.now() + 3_600_000)
            });

            const optionsResponse = await app.handle(new Request("http://localhost/register/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name: "Mom", username: "mom", gender: "mom" })
            }));
            expect(optionsResponse.status).toBe(200);

            failRegistrationVerification = true;
            const firstVerifyResponse = await app.handle(new Request("http://localhost/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    tempEmail: email,
                    registrationResponse: { id: "mock-credential-id" },
                    rsaPublicKeyBase64: "bW9ja19wdWJsaWNfa2V5",
                    encryptedRsaPrivateKeyBase64: "bW9ja19lbmNyeXB0ZWRfcHJpdmF0ZV9rZXk=",
                    prfSaltBase64: "YzJGc2RDMHhNak0w"
                })
            }));
            expect(firstVerifyResponse.status).toBe(400);

            failRegistrationVerification = false;
            const secondVerifyResponse = await app.handle(new Request("http://localhost/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    tempEmail: email,
                    registrationResponse: { id: "mock-credential-id" },
                    rsaPublicKeyBase64: "bW9ja19wdWJsaWNfa2V5",
                    encryptedRsaPrivateKeyBase64: "bW9ja19lbmNyeXB0ZWRfcHJpdmF0ZV9rZXk=",
                    prfSaltBase64: "YzJGc2RDMHhNak0w"
                })
            }));

            const secondVerifyJson = await secondVerifyResponse.json();
            expect(secondVerifyResponse.status).toBe(400);
            expect(String(secondVerifyJson.message || "")).toContain("Challenge not found or expired");
        } finally {
            process.env.NODE_ENV = previousEnv;
            failRegistrationVerification = false;
        }
    });

    it("consumes login challenge after successful verification and omits token from JSON body", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const email = "challenge-login@example.com";
            const userId = "challenge-login-user";
            const familyId = new mongoose.Types.ObjectId();

            await Family.create({
                _id: familyId,
                name: "Family Login Challenge",
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
                familyId: familyId.toString(),
                webauthnCredentialId: "AQID",
                webauthnPublicKey: "AQID",
                webauthnCounter: 0,
                gender: "dad"
            });

            const optionsResponse = await app.handle(new Request("http://localhost/login/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            }));
            expect(optionsResponse.status).toBe(200);

            const firstVerifyResponse = await app.handle(new Request("http://localhost/login/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    authenticationResponse: { id: "AQID" }
                })
            }));
            expect(firstVerifyResponse.status).toBe(200);
            const firstVerifyJson = await firstVerifyResponse.json();
            expect(firstVerifyJson.verified).toBe(true);
            expect(firstVerifyJson.userId).toBe(userId);
            expect(firstVerifyJson.token).toBeUndefined();

            const secondVerifyResponse = await app.handle(new Request("http://localhost/login/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    authenticationResponse: { id: "AQID" }
                })
            }));
            expect(secondVerifyResponse.status).toBe(401);
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });

    it("consumes session-scoped login challenge key when email is not provided", async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        try {
            const userId = "session-only-user";
            const familyId = new mongoose.Types.ObjectId();

            await Family.create({
                _id: familyId,
                name: "Family Session Challenge",
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
                email: "session-only@example.com",
                familyId: familyId.toString(),
                webauthnCredentialId: "AQID",
                webauthnPublicKey: "AQID",
                webauthnCounter: 0,
                gender: "dad"
            });

            const sessionToken = await signJwt({
                userId,
                familyId: familyId.toString(),
                role: "dad",
                gender: "dad"
            });

            const optionsResponse = await app.handle(new Request("http://localhost/login/options", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": `token=${sessionToken}`
                },
                body: JSON.stringify({})
            }));
            expect(optionsResponse.status).toBe(200);

            const firstVerifyResponse = await app.handle(new Request("http://localhost/login/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": `token=${sessionToken}`
                },
                body: JSON.stringify({
                    authenticationResponse: { id: "AQID" }
                })
            }));
            expect(firstVerifyResponse.status).toBe(200);

            const secondVerifyResponse = await app.handle(new Request("http://localhost/login/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": `token=${sessionToken}`
                },
                body: JSON.stringify({
                    authenticationResponse: { id: "AQID" }
                })
            }));
            expect(secondVerifyResponse.status).toBe(401);
        } finally {
            process.env.NODE_ENV = previousEnv;
        }
    });
});
