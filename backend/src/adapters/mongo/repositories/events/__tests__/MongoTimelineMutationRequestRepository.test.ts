import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";
import { MongoTimelineMutationRequestRepository } from "../MongoTimelineMutationRequestRepository";

describe("MongoTimelineMutationRequestRepository", () => {
    let mongoServer: MongoMemoryServer;
    let repository: MongoTimelineMutationRequestRepository;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoTimelineMutationRequestRepository();
        await repository.ensureIndexes();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await repository.ensureIndexes();
        await repository.deleteAll();
    });

    it("stores and retrieves a create request by idempotency key", async () => {
        await repository.save({
            idempotencyKey: "idem-1",
            operation: "CREATE_TIMELINE_ITEM",
            status: "COMPLETED",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });

        const stored = await repository.findByIdempotencyKey("idem-1");
        expect(stored).toMatchObject({
            idempotencyKey: "idem-1",
            operation: "CREATE_TIMELINE_ITEM",
            status: "COMPLETED",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });
    });

    it("enforces one record per idempotency key", async () => {
        await repository.save({
            idempotencyKey: "idem-dup",
            operation: "CREATE_TIMELINE_ITEM",
            status: "COMPLETED",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });

        await expect(repository.save({
            idempotencyKey: "idem-dup",
            operation: "CREATE_TIMELINE_ITEM",
            status: "COMPLETED",
            timelineItemId: "event-2",
            requestHash: "hash-2",
        })).rejects.toThrow();
    });

    it("allows the same request to advance from in-progress to completed", async () => {
        await repository.save({
            idempotencyKey: "idem-progress",
            operation: "CREATE_TIMELINE_ITEM",
            status: "IN_PROGRESS",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });

        await repository.update({
            idempotencyKey: "idem-progress",
            operation: "CREATE_TIMELINE_ITEM",
            status: "COMPLETED",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });

        const stored = await repository.findByIdempotencyKey("idem-progress");
        expect(stored).toMatchObject({
            idempotencyKey: "idem-progress",
            status: "COMPLETED",
            timelineItemId: "event-1",
            requestHash: "hash-1",
        });
    });
});
