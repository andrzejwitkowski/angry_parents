import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoPasskeyRepository } from "../MongoPasskeyRepository";
import { PasskeyModel } from "../../../models/PasskeyModel";
import type { Passkey } from "../../../../../domain/auth/model/Passkey";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";

describe("MongoPasskeyRepository", () => {
    let repository: MongoPasskeyRepository;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoPasskeyRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await PasskeyModel.deleteMany({});
    });

    const mockPasskey: Passkey = {
        userId: "user-123",
        webauthnUserId: "webauthn-456",
        credentialID: Buffer.from([1, 2, 3, 4]),
        credentialPublicKey: Buffer.from([5, 6, 7, 8]),
        counter: 0,
        transports: ["internal"],
        createdAt: new Date(),
        name: "Test Passkey"
    };

    it("should save and retrieve by credentialID", async () => {
        await repository.save(mockPasskey);

        const found = await repository.findByCredentialID(mockPasskey.credentialID);
        expect(found).not.toBeNull();
        expect(found?.userId).toBe(mockPasskey.userId);
        expect(Buffer.from(found!.credentialID).toString("hex")).toBe(Buffer.from(mockPasskey.credentialID).toString("hex"));
        expect(Buffer.from(found!.credentialPublicKey).toString("hex")).toBe(Buffer.from(mockPasskey.credentialPublicKey).toString("hex"));
    });

    it("should return null for non-existent credentialID", async () => {
        const found = await repository.findByCredentialID(Buffer.from([9, 9, 9]));
        expect(found).toBeNull();
    });

    it("should update existing passkey", async () => {
        await repository.save(mockPasskey);

        const updated = { ...mockPasskey, counter: 5 };
        await repository.save(updated);

        const found = await repository.findByCredentialID(mockPasskey.credentialID);
        expect(found?.counter).toBe(5);
    });

    it("should find multiple by userId", async () => {
        await repository.save(mockPasskey);

        const secondPasskey: Passkey = {
            ...mockPasskey,
            credentialID: Buffer.from([10, 11]),
            name: "Second Passkey"
        };
        await repository.save(secondPasskey);

        const unrelated: Passkey = {
            ...mockPasskey,
            userId: "user-999",
            credentialID: Buffer.from([99])
        };
        await repository.save(unrelated);

        const found = await repository.findByUserId("user-123");
        expect(found.length).toBe(2);

        const names = found.map(p => p.name);
        expect(names).toContain("Test Passkey");
        expect(names).toContain("Second Passkey");
    });

    it("should count passkeys by userId", async () => {
        await repository.save(mockPasskey);
        await repository.save({
            ...mockPasskey,
            credentialID: Buffer.from([10, 11]),
        });

        const count = await repository.countByUserId("user-123");
        expect(count).toBe(2);
    });

    it("should update counter independently", async () => {
        await repository.save(mockPasskey);

        await repository.updateCounter(mockPasskey.credentialID, 42);

        const found = await repository.findByCredentialID(mockPasskey.credentialID);
        expect(found?.counter).toBe(42);
    });
});
