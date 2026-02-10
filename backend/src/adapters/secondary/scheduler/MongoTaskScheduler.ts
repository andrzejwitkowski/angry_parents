
import mongoose, { Schema, Document, Model } from 'mongoose';
import { ITask, ITaskManager, TaskStatus, JsonValue } from '../../../core/ports/TaskScheduler';
import { randomUUID } from 'crypto';

// Define the interface for Mongoose document
// We omit 'id' because Mongoose uses '_id'
// Helper type to avoid recursive type depth issues in Mongoose Schema definition
interface ITaskSchemaDocument extends Omit<ITask, 'id' | 'payload'>, Document {
    payload: unknown;
    _id: mongoose.Types.ObjectId;
}

const TaskSchema = new Schema<ITaskSchemaDocument>({
    type: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
        type: String,
        enum: Object.values(TaskStatus),
        default: TaskStatus.NEW,
        index: true
    },
    scheduledAt: { type: Date, required: true, index: true },
    retryCount: { type: Number, default: 0 },
    retryPolicy: {
        maxRetries: { type: Number, default: 3 },
        initialDelayMinutes: { type: Number, default: 1 }
    },
    workerId: { type: String, default: null },
    lockedUntil: { type: Date, default: null, index: true },
    error: { type: String, default: null }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret: { _id?: unknown; __v?: unknown;[key: string]: unknown }) => {
            if (ret._id) {
                ret.id = String(ret._id);
            }
            delete ret._id;
            delete ret.__v;
        }
    }
});

// Compound index for efficient polling
TaskSchema.index({ status: 1, scheduledAt: 1, lockedUntil: 1 });

// Full interface for class usage
interface ITaskDocument extends Omit<ITask, 'id'>, Document {
    _id: mongoose.Types.ObjectId;
}

export class MongoTaskScheduler implements ITaskManager {
    private TaskModel: Model<ITaskDocument>;
    private handlers: Map<string, (payload: JsonValue) => Promise<void>> = new Map();
    private isRunning: boolean = false;
    private workerId: string;
    private pollIntervalMs: number;
    private visibilityTimeoutMs: number;
    private loopPromise?: Promise<void>;

    constructor(
        connectionString: string,
        pollIntervalMs: number = 1000,
        visibilityTimeoutMs: number = 5 * 60 * 1000 // 5 minutes
    ) {
        this.workerId = randomUUID();
        this.pollIntervalMs = pollIntervalMs;
        this.visibilityTimeoutMs = visibilityTimeoutMs;

        // Connect to mongoose if not already connected (or handle connection externally)
        // For this module, we assume mongoose might be shared, but we can register the model.
        // To avoid OverwriteModelError, check if model exists
        this.TaskModel = (mongoose.models.Task as Model<ITaskDocument>) ||
            (mongoose.model<ITaskSchemaDocument>('Task', TaskSchema) as object as Model<ITaskDocument>);
    }

    registerHandler<T>(type: string, handler: (payload: T) => Promise<void>): void {
        if (this.handlers.has(type)) {
            console.warn(`Handler for task type '${type}' is being overwritten.`);
        }
        this.handlers.set(type, handler as (payload: JsonValue) => Promise<void>);
    }

    async scheduleTask<T>(type: string, payload: T, options?: Partial<ITask<T>>): Promise<ITask<T>> {
        const task = new this.TaskModel({
            type,
            payload,
            status: TaskStatus.NEW,
            scheduledAt: options?.scheduledAt || new Date(),
            retryPolicy: options?.retryPolicy || { maxRetries: 3, initialDelayMinutes: 1 }
        });
        const saved = await task.save();
        return saved.toJSON() as unknown as ITask<T>;
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`Task Scheduler started. Worker ID: ${this.workerId}`);
        this.loopPromise = this.loop();
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        console.log('Task Scheduler stopping...');
        if (this.loopPromise) {
            await this.loopPromise;
            this.loopPromise = undefined;
        }
        console.log('Task Scheduler stopped.');
    }

    private async loop(): Promise<void> {
        while (this.isRunning) {
            try {
                const task = await this.claimTask();
                if (task) {
                    await this.processTask(task);
                } else {
                    // Wait for pollInterval, but allow interruption if stopped
                    for (let i = 0; i < this.pollIntervalMs; i += 100) {
                        if (!this.isRunning) break;
                        await new Promise(resolve => setTimeout(resolve, Math.min(100, this.pollIntervalMs - i)));
                    }
                }
            } catch (error) {
                console.error('Error in task execution loop:', error);
                // Sleep to avoid busy loop in case of transient DB errors
                await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
            }
        }
    }

    private async claimTask(): Promise<ITaskDocument | null> {
        const now = new Date();

        // Find and lock a task
        // Criteria:
        // 1. Status is NEW, scheduled <= now
        // OR
        // 2. Status is PENDING, lockedUntil <= now (Zombie)

        const task = await this.TaskModel.findOneAndUpdate(
            {
                $or: [
                    { status: TaskStatus.NEW, scheduledAt: { $lte: now } },
                    { status: TaskStatus.PENDING, lockedUntil: { $lte: now } }
                ]
            },
            {
                $set: {
                    status: TaskStatus.PENDING,
                    workerId: this.workerId,
                    lockedUntil: new Date(now.getTime() + this.visibilityTimeoutMs)
                }
            },
            { new: true, sort: { scheduledAt: 1 } } // Process oldest tasks first
        );

        return task;
    }

    private async processTask(task: ITaskDocument): Promise<void> {
        const handler = this.handlers.get(task.type);

        if (!handler) {
            console.error(`No handler registered for task type: ${task.type}`);
            // Mark as failed or maybe exponential backoff to retry later in case handler is registered later?
            // For now, let's mark as failed to avoid infinite loop of claiming.
            await this.markAsFailed(task, `No handler registered for type ${task.type}`);
            return;
        }

        try {
            await handler(task.payload);
            await this.markAsSuccess(task);
        } catch (error) {
            console.error(`Error processing task ${task._id}:`, error);
            await this.handleFailure(task, error as Error | string | object);
        }
    }

    private async markAsSuccess(task: ITaskDocument): Promise<void> {
        await this.TaskModel.updateOne(
            { _id: task._id },
            {
                $set: {
                    status: TaskStatus.SUCCESS,
                    lockedUntil: null,
                    error: null
                }
            }
        );
    }

    private async markAsFailed(task: ITaskDocument, error: Error | string | object | null | undefined): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.TaskModel.updateOne(
            { _id: task._id },
            {
                $set: {
                    status: TaskStatus.FAILED,
                    lockedUntil: null,
                    error: errorMessage
                }
            }
        );
    }

    private async handleFailure(task: ITaskDocument, error: Error | string | object | null | undefined): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryCount = task.retryCount + 1;
        const maxRetries = task.retryPolicy.maxRetries;

        if (retryCount <= maxRetries) {
            // Calculate delay: initialDelay * 2^retryCount
            const delayMinutes = task.retryPolicy.initialDelayMinutes * Math.pow(2, retryCount);
            const nextScheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

            await this.TaskModel.updateOne(
                { _id: task._id },
                {
                    $set: {
                        status: TaskStatus.NEW, // Reset to NEW so it can be picked up again
                        retryCount: retryCount,
                        scheduledAt: nextScheduledAt,
                        lockedUntil: null, // Release lock
                        workerId: null,
                        error: errorMessage
                    }
                }
            );
        } else {
            // Terminal failure
            await this.markAsFailed(task, error);
        }
    }

    // Method to clear all tasks (useful for testing)
    async clearAllTasks(): Promise<void> {
        await this.TaskModel.deleteMany({});
    }
}
