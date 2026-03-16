import type { TimelineMutationRequestRecord, TimelineMutationRequestRepository } from "../../../../domain/events/ports/TimelineMutationRequestRepository";

export class InMemoryTimelineMutationRequestRepository implements TimelineMutationRequestRepository {
    private records = new Map<string, TimelineMutationRequestRecord>();

    async save(record: TimelineMutationRequestRecord, _session?: unknown): Promise<void> {
        if (this.records.has(record.idempotencyKey)) {
            throw new Error(`Mutation request with idempotency key ${record.idempotencyKey} already exists`);
        }

        this.records.set(record.idempotencyKey, { ...record });
    }

    async update(record: TimelineMutationRequestRecord, _session?: unknown): Promise<void> {
        this.records.set(record.idempotencyKey, { ...record });
    }

    async findByIdempotencyKey(idempotencyKey: string): Promise<TimelineMutationRequestRecord | null> {
        const record = this.records.get(idempotencyKey);
        return record ? { ...record } : null;
    }
}
