import { describe, expect, it } from "vitest";
import { InMemoryTimelineMutationRequestRepository } from "../InMemoryTimelineMutationRequestRepository";

describe("InMemoryTimelineMutationRequestRepository", () => {
    it("returns a cloned record so callers cannot mutate repository state implicitly", async () => {
        const repository = new InMemoryTimelineMutationRequestRepository();
        await repository.save({
            idempotencyKey: "idem-1",
            operation: "CREATE_TIMELINE_ITEM",
            status: "IN_PROGRESS",
            requestHash: "hash-1",
            timelineItemId: "event-1",
        });

        const firstRead = await repository.findByIdempotencyKey("idem-1");
        expect(firstRead).not.toBeNull();
        firstRead!.status = "COMPLETED";
        firstRead!.timelineItemId = "event-2";

        const secondRead = await repository.findByIdempotencyKey("idem-1");
        expect(secondRead).toMatchObject({
            idempotencyKey: "idem-1",
            status: "IN_PROGRESS",
            timelineItemId: "event-1",
        });
    });
});
