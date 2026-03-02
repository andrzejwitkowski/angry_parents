export enum TaskType {
    SYNC_USER_PENDING_DOCS = 'SYNC_USER_PENDING_DOCS',
    PROCESS_DOCUMENT_INTEGRITY = 'PROCESS_DOCUMENT_INTEGRITY',
    BLOCKCHAIN_PUBLISH = 'BLOCKCHAIN_PUBLISH',
    PROCESS_FORENSIC_INTENT = 'PROCESS_FORENSIC_INTENT',
}

export enum TaskStatus {
    NEW = 'NEW',
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface ITask<T> {
    id?: string;
    type: TaskType;
    payload: T;
    payloadHash: string;
    status: TaskStatus;
    scheduledAt: Date;
    retryCount: number;
    retryPolicy: {
        maxRetries: number;
        initialDelayMinutes: number;
    };
    workerId?: string | null;
    lockedUntil?: Date | null;
    error?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export type TaskHandler<T> = (payload: T) => Promise<void>;

export interface ScheduleOptions {
    scheduledAt?: Date;
    retryPolicy?: {
        maxRetries: number;
        initialDelayMinutes: number;
    };
}

export interface ITaskManager {
    registerHandler<T>(type: TaskType, handler: (payload: T) => Promise<void>): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    schedule<T>(type: TaskType, payload: T, options?: ScheduleOptions): Promise<ITask<T>>;
}
