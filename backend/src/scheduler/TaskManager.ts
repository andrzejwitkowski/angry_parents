import mongoose, { Schema, Document, Model } from 'mongoose';
import { ITask, TaskStatus, TaskType, TaskHandler, ScheduleOptions, ITaskManager } from './types.ts';
import { calculatePayloadHash } from './utils/crypto.ts';
import { randomUUID } from 'crypto';
import { ObservabilityService } from '../domain/shared/ports/ObservabilityService';

// Mongoose Document Interface
// We treat payload as `any` at the DB level but strictly typed at the Manager level
interface ITaskDocument extends Document, Omit<ITask<unknown>, 'id'> {
    _id: mongoose.Types.ObjectId;
}

const TaskSchema = new Schema<ITaskDocument>(
    {
        type: { type: String, enum: Object.values(TaskType), required: true },
        payload: { type: Schema.Types.Mixed, required: true },
        payloadHash: { type: String, required: true },
        status: {
            type: String,
            enum: Object.values(TaskStatus),
            default: TaskStatus.NEW,
            required: true,
        },
        scheduledAt: { type: Date, required: true, default: Date.now },
        retryCount: { type: Number, default: 0 },
        retryPolicy: {
            maxRetries: { type: Number, default: 3 },
            initialDelayMinutes: { type: Number, default: 1 },
        },
        workerId: { type: String, default: null },
        lockedUntil: { type: Date, default: null },
        processingStartedAt: { type: Date, default: null },
        timeoutMinutes: { type: Number, default: 10 },
        error: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: Record<string, unknown>) => {
                if (ret._id && typeof ret._id === 'object' && 'toString' in ret._id) {
                    ret.id = (ret._id as { toString: () => string }).toString();
                }
                delete ret._id;
                delete ret.__v;
            },
        },
    }
);

// Index for Polling: status + scheduledAt + lockedUntil
TaskSchema.index({ status: 1, scheduledAt: 1, lockedUntil: 1 });

// Index for Deduplication: type + payloadHash + status (partial check)
// Unique index to prevent duplicate ACTIVE tasks.
// If a task is COMPLETED or FAILED, we might want to allow a new one?
// The requirement says: "Duplicate Prevention: Verify that trying to insert the same task twice results in only one record".
// "Insertion Guard: Implement a unique index on { type: 1, payloadHash: 1, status: 1 } where status is new or pending."
// Let's strictly follow the requirement.
// However, simple unique index on type+hash+status might allow multiple "NEW" if status is part of the key? No, status IS part of key.
// But we want to prevent a NEW one if there is ALREADY a NEW/PENDING/PROCESSING one.
// Complex unique indexes with partial filter expressions are better.
// "unique index on { type: 1, payloadHash: 1 } where status IN [NEW, PENDING, PROCESSING]"?
// MongoDB supports partial indexes.

TaskSchema.index(
    { type: 1, payloadHash: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: [TaskStatus.NEW, TaskStatus.PENDING, TaskStatus.PROCESSING] },
        },
    }
);

export class TaskManager implements ITaskManager {
    private model: Model<ITaskDocument>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handlers: Map<TaskType, TaskHandler<any>> = new Map();
    private isRunning = false;
    private workerId: string;
    private pollIntervalMs: number;
    private visibilityTimeoutMs: number;
    private loopPromise: Promise<void> | null = null;
    private abortController: AbortController | null = null;
    private observability: ObservabilityService;

    constructor(
        observability: ObservabilityService,
        pollIntervalMs = 1000,
        visibilityTimeoutMs = 5 * 60 * 1000 // 5 minutes
    ) {
        this.observability = observability;
        this.workerId = randomUUID();
        this.pollIntervalMs = pollIntervalMs;
        this.visibilityTimeoutMs = visibilityTimeoutMs;

        // Register model if not already registered (singleton pattern for Model)
        this.model =
            (mongoose.models.Task as Model<ITaskDocument>) ||
            mongoose.model<ITaskDocument>('Task', TaskSchema);
    }

    public registerHandler<T>(type: TaskType, handler: TaskHandler<T>): void {
        if (this.handlers.has(type)) {
            console.warn(`[TaskManager] Overwriting handler for task type ${type}`);
        }
        this.handlers.set(type, handler);
    }

    public async schedule<T>(
        type: TaskType,
        payload: T,
        options?: ScheduleOptions
    ): Promise<ITask<T>> {
        const payloadHash = calculatePayloadHash(payload);
        const scheduledAt = options?.scheduledAt || new Date();

        const taskData: Partial<ITask<T>> = {
            type,
            payload,
            payloadHash,
            status: TaskStatus.NEW,
            scheduledAt,
            retryPolicy: options?.retryPolicy || {
                maxRetries: 3,
                initialDelayMinutes: 1,
            },
        };

        try {
            // Try to create the task
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const created = await this.model.create(taskData as any);
            return created.toJSON() as ITask<T>;
        } catch (error) {
            // Handle duplicate key error (E11000)
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                (error as { code: number }).code === 11000
            ) {
                // Task already exists (active). Return the existing one.
                const existing = await this.model.findOne({
                    type,
                    payloadHash,
                    status: { $in: [TaskStatus.NEW, TaskStatus.PENDING, TaskStatus.PROCESSING] },
                });
                if (existing) {
                    return existing.toJSON() as ITask<T>;
                }
            }
            throw error;
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        this.abortController = new AbortController();
        console.log(`[TaskManager] Worker ${this.workerId} started.`);
        this.loopPromise = this.loop();
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.abortController?.abort();
        console.log(`[TaskManager] Worker ${this.workerId} stopping...`);
        if (this.loopPromise) {
            await this.loopPromise;
        }
        console.log(`[TaskManager] Worker ${this.workerId} stopped.`);
    }

    private async loop(): Promise<void> {
        while (this.isRunning) {
            try {
                const task = await this.claimTask();
                if (task) {
                    await this.processTask(task);
                } else {
                    // No task found, sleep
                    await this.sleep(this.pollIntervalMs);
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') break;
                console.error('[TaskManager] Error in loop:', error);
                await this.sleep(this.pollIntervalMs);
            }
        }
    }

    private async claimTask(): Promise<ITaskDocument | null> {
        const now = new Date();
        const lockExpiration = new Date(now.getTime() + this.visibilityTimeoutMs);

        // 1. Detect and handle timed-out tasks
        // A task is timed out if it's PROCESSING and now > processingStartedAt + timeoutMinutes
        // We use a single updateMany for efficiency but fetch IDs first for observability.
        const timeoutQuery = {
            status: TaskStatus.PROCESSING,
            processingStartedAt: { $ne: null },
            $expr: {
                $gt: [
                    now,
                    { $add: ["$processingStartedAt", { $multiply: ["$timeoutMinutes", 60, 1000] }] }
                ]
            }
        };

        const timedOutTasks = await this.model.find(timeoutQuery, { type: 1, _id: 1, timeoutMinutes: 1, processingStartedAt: 1 }).lean();

        if (timedOutTasks.length > 0) {
            await this.model.updateMany(
                { _id: { $in: timedOutTasks.map(t => t._id) } },
                { $set: { status: TaskStatus.TIMED_OUT, lockedUntil: null } }
            );

            for (const task of timedOutTasks) {
                this.observability.trackTimeout(task.type, task._id.toString(), {
                    processingStartedAt: task.processingStartedAt,
                    timeoutMinutes: task.timeoutMinutes
                });
            }
        }

        // 2. Claim available tasks
        // Query for tasks that are:
        // 1. NEW and scheduledAt <= now
        // 2. OR PENDING and lockedUntil <= now (expired lock / zombie)
        const query = {
            $or: [
                { status: TaskStatus.NEW, scheduledAt: { $lte: now } },
                { status: TaskStatus.PENDING, lockedUntil: { $lte: now } },
            ],
        };

        const update = {
            $set: {
                status: TaskStatus.PENDING,
                workerId: this.workerId,
                lockedUntil: lockExpiration,
            },
        };

        // Sort by scheduledAt asc (FIFO)
        return this.model.findOneAndUpdate(query, update, {
            returnDocument: 'after',
            sort: { scheduledAt: 1 },
        });
    }

    private async processTask(task: ITaskDocument): Promise<void> {
        const handler = this.handlers.get(task.type as TaskType);
        if (!handler) {
            console.error(`[TaskManager] No handler for type ${task.type}`);
            await this.failTask(task, `No handler registered for type ${task.type}`);
            return;
        }

        try {
            // Execute Handler
            task.status = TaskStatus.PROCESSING;
            task.processingStartedAt = new Date();
            await task.save();

            await handler(task.payload);

            // Success
            await this.completeTask(task);
        } catch (error) {
            console.error(`[TaskManager] Task failed: ${task._id}`, error);
            await this.retryOrFailTask(task, error as Error);
        }
    }

    private async completeTask(task: ITaskDocument): Promise<void> {
        await this.model.updateOne(
            { _id: task._id },
            {
                $set: {
                    status: TaskStatus.COMPLETED,
                    lockedUntil: null,
                    error: null,
                },
            }
        );
    }

    private async failTask(task: ITaskDocument, errorMessage: string): Promise<void> {
        await this.model.updateOne(
            { _id: task._id },
            {
                $set: {
                    status: TaskStatus.FAILED,
                    lockedUntil: null,
                    error: errorMessage,
                },
            }
        );
    }

    private async retryOrFailTask(task: ITaskDocument, error: Error): Promise<void> {
        const maxRetries = task.retryPolicy.maxRetries;
        const currentRetries = task.retryCount;

        if (currentRetries < maxRetries) {
            // Retry
            const nextRetryCount = currentRetries + 1;
            // Exponential Backoff: initialDelay * 2^(retryCount - 1)?
            // User formula: initialDelay * 2^retryCount.
            // If retryCount becomes 1, it is init * 2^1 = 2 * init.
            // Usually it's init * 2^retryCount where retryCount starts at 0 for first retry? 
            // "retryCount" in DB usually means "how many times have we retried".
            // Let's increment first.

            const delayMinutes = task.retryPolicy.initialDelayMinutes * Math.pow(2, nextRetryCount);
            const nextScheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

            await this.model.updateOne(
                { _id: task._id },
                {
                    $set: {
                        status: TaskStatus.NEW, // Release to pool
                        scheduledAt: nextScheduledAt,
                        retryCount: nextRetryCount,
                        lockedUntil: null,
                        workerId: null,
                        error: error.message,
                    },
                }
            );
            console.log(`[TaskManager] Task ${task._id} scheduled for retry ${nextRetryCount} at ${nextScheduledAt}`);
        } else {
            // Max retries reached
            await this.failTask(task, error.message);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            this.abortController?.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                // reject(new Error('AbortError')); // or just resolve to exit cleanly
                resolve();
            });
        });
    }
}
