export type TaskOutboxStatus = "PENDING" | "CLAIMED" | "DISPATCHED";

export interface TaskOutboxRecord {
    id?: string;
    taskType: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    retryPolicy?: {
        maxRetries: number;
        initialDelayMinutes: number;
    };
    status: TaskOutboxStatus;
    availableAt?: Date;
    lockedUntil?: Date | null;
}

export interface TaskOutboxAppendInput {
    taskType: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    retryPolicy?: {
        maxRetries: number;
        initialDelayMinutes: number;
    };
}

export interface TaskOutboxRepository {
    ensureIndexes?(): Promise<void>;
    append(entry: TaskOutboxAppendInput, session?: unknown): Promise<void>;
    claimNext(): Promise<TaskOutboxRecord | null>;
    markDispatched(id: string): Promise<void>;
    markPending?(id: string): Promise<void>;
}
