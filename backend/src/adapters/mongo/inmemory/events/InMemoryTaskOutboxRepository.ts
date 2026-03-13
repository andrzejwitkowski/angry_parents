import type { TaskOutboxAppendInput, TaskOutboxRecord, TaskOutboxRepository } from "../../../../domain/shared/ports/TaskOutboxRepository";

export class InMemoryTaskOutboxRepository implements TaskOutboxRepository {
    private entries: TaskOutboxRecord[] = [];
    private nextId = 1;

    async append(entry: TaskOutboxAppendInput): Promise<void> {
        const existing = this.entries.find((candidate) => (
            candidate.taskType === entry.taskType && candidate.payloadHash === entry.payloadHash
        ));
        if (existing) {
            return;
        }

        this.entries.push({
            id: String(this.nextId++),
            ...entry,
            status: "PENDING",
            availableAt: new Date(),
            lockedUntil: null,
        });
    }

    async claimNext(): Promise<TaskOutboxRecord | null> {
        const next = this.entries.find((entry) => entry.status === "PENDING");
        if (!next) {
            return null;
        }

        next.status = "CLAIMED";
        next.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        return { ...next };
    }

    async markDispatched(id: string): Promise<void> {
        const entry = this.entries.find((candidate) => candidate.id === id);
        if (!entry) {
            throw new Error(`Outbox entry ${id} not found`);
        }

        entry.status = "DISPATCHED";
        entry.lockedUntil = null;
    }

    async markPending(id: string): Promise<void> {
        const entry = this.entries.find((candidate) => candidate.id === id);
        if (!entry) {
            throw new Error(`Outbox entry ${id} not found`);
        }

        entry.status = "PENDING";
        entry.lockedUntil = null;
    }

    async getAll(): Promise<TaskOutboxRecord[]> {
        return this.entries.map((entry) => ({ ...entry }));
    }
}
