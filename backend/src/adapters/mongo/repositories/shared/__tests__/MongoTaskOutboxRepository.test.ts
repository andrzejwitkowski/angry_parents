import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";
import { MongoTaskOutboxRepository } from "../MongoTaskOutboxRepository";
import { TaskOutboxModel } from "../../../models/TaskOutboxModel";

describe("MongoTaskOutboxRepository", () => {
    let mongoServer: MongoMemoryServer;
    let repository: MongoTaskOutboxRepository;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoTaskOutboxRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(async () => {
        await repository.deleteAll();
    });

    it("stores and claims a pending outbox entry", async () => {
        await repository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-1", version: 1 },
            payloadHash: "payload-hash-1",
        });

        const claimed = await repository.claimNext();
        expect(claimed).toMatchObject({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-1", version: 1 },
            payloadHash: "payload-hash-1",
            status: "CLAIMED",
        });
    });

    it("marks a claimed outbox entry as dispatched", async () => {
        await repository.append({
            taskType: "PROCESS_FORENSIC_INTENT",
            payload: { intentId: "intent-1" },
            payloadHash: "payload-hash-2",
        });

        const claimed = await repository.claimNext();
        await repository.markDispatched(claimed!.id!);

        const pending = await repository.claimNext();
        expect(pending).toBeNull();
    });

    it("forwards the provided transaction session when appending entries", async () => {
        const updateOneSpy = vi.spyOn(TaskOutboxModel, "updateOne").mockResolvedValue({} as never);
        const session = { fake: true };

        await repository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-tx", version: 2 },
            payloadHash: "payload-hash-tx",
        }, session);

        expect(updateOneSpy).toHaveBeenCalledWith(
            {
                taskType: "PUBLISH_EVENT_PROOF",
                payloadHash: "payload-hash-tx",
            },
            {
                $setOnInsert: expect.objectContaining({
                    taskType: "PUBLISH_EVENT_PROOF",
                    payloadHash: "payload-hash-tx",
                    status: "PENDING",
                }),
            },
            expect.objectContaining({ session, upsert: true })
        );
    });

    it("stores retry policy alongside the outbox entry", async () => {
        await repository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-retry", version: 4 },
            payloadHash: "payload-hash-retry",
            retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 },
        });

        const claimed = await repository.claimNext();
        expect(claimed).toMatchObject({
            taskType: "PUBLISH_EVENT_PROOF",
            retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 },
        });
    });

    it("reclaims a stale claimed entry after the lock expires", async () => {
        await repository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-stale", version: 3 },
            payloadHash: "payload-hash-stale",
        });

        const firstClaim = await repository.claimNext();
        expect(firstClaim?.status).toBe("CLAIMED");

        await TaskOutboxModel.updateOne(
            { _id: firstClaim!.id! },
            { $set: { lockedUntil: new Date(Date.now() - 1000) } }
        );

        const reclaimed = await repository.claimNext();
        expect(reclaimed).toMatchObject({
            id: firstClaim!.id,
            taskType: "PUBLISH_EVENT_PROOF",
            payloadHash: "payload-hash-stale",
            status: "CLAIMED",
        });
    });
});
