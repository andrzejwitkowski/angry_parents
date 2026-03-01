import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { PasskeyRepository } from "../../../core/ports/PasskeyRepository";
import type { Passkey } from "../../../core/domain/Passkey";
import { InMemoryPasskeyRepository } from "../InMemoryPasskeyRepository";
import { MongoPasskeyRepository } from "../MongoPasskeyRepository";
import { PasskeyModel } from "../../../models/Passkey";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoMemory, disconnectMongoMemory } from "./mongoMemoryServer";

function contractSuite(label: string, createRepository: () => PasskeyRepository, cleanup?: () => Promise<void>) {
    describe(`PasskeyRepository contract (${label})`, () => {
        let repository: PasskeyRepository;

        beforeEach(async () => {
            repository = createRepository();
            if (cleanup) await cleanup();
        });

        it("supports save/find/count/updateCounter contract", async () => {
            const passkey: Passkey = {
                userId: "user-1",
                webauthnUserId: "wa-1",
                credentialID: Buffer.from([1, 2, 3]),
                credentialPublicKey: Buffer.from([9, 8, 7]),
                counter: 0,
                transports: ["internal"],
                createdAt: new Date(),
                name: "Primary"
            };

            await repository.save(passkey);
            await repository.save({ ...passkey, counter: 3 });

            const byCredential = await repository.findByCredentialID(passkey.credentialID);
            expect(byCredential).not.toBeNull();
            expect(byCredential?.counter).toBe(3);

            const byUser = await repository.findByUserId("user-1");
            expect(byUser.length).toBe(1);

            const count = await repository.countByUserId("user-1");
            expect(count).toBe(1);

            await repository.updateCounter(passkey.credentialID, 12);
            const updated = await repository.findByCredentialID(passkey.credentialID);
            expect(updated?.counter).toBe(12);
        });
    });
}

describe("PasskeyRepository contract", () => {
    contractSuite("InMemory", () => new InMemoryPasskeyRepository());

    describe("Mongo", () => {
        let mongoServer: MongoMemoryServer;

        beforeAll(async () => {
            mongoServer = await connectMongoMemory();
        });

        afterAll(async () => {
            await disconnectMongoMemory(mongoServer);
        });

        contractSuite(
            "Mongo",
            () => new MongoPasskeyRepository(),
            async () => {
                await PasskeyModel.deleteMany({});
            }
        );
    });
});
