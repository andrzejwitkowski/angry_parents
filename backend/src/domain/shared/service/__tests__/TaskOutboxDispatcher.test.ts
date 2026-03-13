import { describe, expect, it, vi } from "vitest";
import { InMemoryTaskOutboxRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTaskOutboxRepository";
import { TaskOutboxDispatcher } from "../TaskOutboxDispatcher";

describe("TaskOutboxDispatcher", () => {
    it("dispatches a claimed outbox entry into TaskManager and marks it dispatched", async () => {
        const outboxRepository = new InMemoryTaskOutboxRepository();
        await outboxRepository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-1", version: 1 },
            payloadHash: "hash-1",
        });

        const schedule = vi.fn().mockResolvedValue({ id: "task-1" });
        const dispatcher = new TaskOutboxDispatcher(outboxRepository as any, { schedule } as any);

        const dispatched = await dispatcher.dispatchNext();

        expect(dispatched).toBe(true);
        expect(schedule).toHaveBeenCalledWith("PUBLISH_EVENT_PROOF", { itemId: "event-1", version: 1 }, undefined);

        const entries = await outboxRepository.getAll();
        expect(entries[0].status).toBe("DISPATCHED");
    });

    it("keeps the outbox entry recoverable when scheduler dispatch fails", async () => {
        const outboxRepository = new InMemoryTaskOutboxRepository();
        await outboxRepository.append({
            taskType: "PROCESS_FORENSIC_INTENT",
            payload: { intentId: "intent-1" },
            payloadHash: "hash-2",
        });

        const schedule = vi.fn().mockRejectedValue(new Error("scheduler offline"));
        const dispatcher = new TaskOutboxDispatcher(outboxRepository as any, { schedule } as any);

        await expect(dispatcher.dispatchNext()).rejects.toThrow("scheduler offline");

        const entries = await outboxRepository.getAll();
        expect(entries[0].status).toBe("PENDING");
    });

    it("forwards retry policy from the outbox entry when dispatching", async () => {
        const outboxRepository = new InMemoryTaskOutboxRepository();
        await outboxRepository.append({
            taskType: "PUBLISH_EVENT_PROOF",
            payload: { itemId: "event-2", version: 3 },
            payloadHash: "hash-3",
            retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 },
        });

        const schedule = vi.fn().mockResolvedValue({ id: "task-2" });
        const dispatcher = new TaskOutboxDispatcher(outboxRepository as any, { schedule } as any);

        const dispatched = await dispatcher.dispatchNext();

        expect(dispatched).toBe(true);
        expect(schedule).toHaveBeenCalledWith(
            "PUBLISH_EVENT_PROOF",
            { itemId: "event-2", version: 3 },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );
    });
});
