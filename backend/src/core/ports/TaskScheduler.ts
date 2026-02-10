export enum TaskStatus {
    NEW = 'new',
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed'
}

// Strict JSON type
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ITaskPayload = { [key: string]: JsonValue } | JsonValue;

export interface ITask<T = JsonValue> {
    id: string;
    type: string;
    payload: T;
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
    createdAt: Date;
    updatedAt: Date;
}

export interface ITaskManager {
    registerHandler<T>(type: string, handler: (payload: T) => Promise<void>): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    scheduleTask<T>(type: string, payload: T, options?: Partial<ITask<T>>): Promise<ITask<T>>;
}
