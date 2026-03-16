import { describe, expect, it } from "vitest";
import { InMemoryTimelineMutationRequestRepository } from "../InMemoryTimelineMutationRequestRepository";

describe("InMemoryTimelineMutationRequestRepository", () => {
    it("throws a Mongo-style duplicate key error when the idempotency key already exists", async () => {
        const repository = new InMemoryTimelineMutationRequestRepository();
        const record = {
            idempotencyKey: "idem-1",
            operation: "CREATE_TIMELINE_ITEM" as const,
            status: "IN_PROGRESS" as const,
            requestHash: "hash-1",
            timelineItemId: "item-1",
        };

        await repository.save(record);

        await expect(repository.save(record)).rejects.toMatchObject({
            code: 11000,
        });
    });
});
