export type TimelineMutationOperation = "CREATE_TIMELINE_ITEM";
export type TimelineMutationRequestStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface TimelineMutationRequestRecord {
    idempotencyKey: string;
    operation: TimelineMutationOperation;
    status: TimelineMutationRequestStatus;
    requestHash: string;
    timelineItemId?: string;
    lastError?: string;
}

export interface TimelineMutationRequestRepository {
    save(record: TimelineMutationRequestRecord, session?: unknown): Promise<void>;
    findByIdempotencyKey(idempotencyKey: string): Promise<TimelineMutationRequestRecord | null>;
    update(record: TimelineMutationRequestRecord, session?: unknown): Promise<void>;
}
