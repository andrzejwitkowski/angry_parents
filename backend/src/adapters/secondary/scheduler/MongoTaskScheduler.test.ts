
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MongoTaskScheduler } from './MongoTaskScheduler';
import { TaskStatus, JsonValue } from '../../../core/ports/TaskScheduler';
import mongoose from 'mongoose';

// Mock storage
let mockDb: MockDocument[] = [];

// Mock Mongoose Document
class MockDocument {
    _id: string;

    [key: string]: JsonValue | Date | number | string | null | undefined | object;

    constructor(data: Record<string, JsonValue | Date | number | string | null | undefined | object>) {
        this._id = (data._id as string) || crypto.randomUUID();
        // Defaults
        this.retryCount = 0;
        this.workerId = null;
        this.lockedUntil = null;
        this.error = null;
        this.status = TaskStatus.NEW;

        Object.assign(this, data);
    }

    toJSON() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = this;
        return { id: this._id, ...rest };
    }

    async save() {
        // Upsert
        const idx = mockDb.findIndex(d => d._id === this._id);
        if (idx >= 0) {
            mockDb[idx] = this;
        } else {
            mockDb.push(this);
        }
        return this;
    }
}

// Mock Mongoose Model


// We need a way to instantiate 'new this.TaskModel({...})'
class MockModelClass extends MockDocument {
    constructor(data: Record<string, JsonValue | Date | number | string | null | undefined | object>) {
        super(data);
    }

    static matches(doc: Record<string, JsonValue | Date | number | string | null | undefined | object>, query: Record<string, JsonValue | Date | number | string | null | undefined | object>): boolean {
        // Handle $or
        if (query.$or && Array.isArray(query.$or)) {
            return query.$or.some((subQuery: Record<string, JsonValue | Date | number | string | null | undefined | object>) => this.matches(doc, subQuery));
        }

        for (const key in query) {
            if (key === '$or') continue; // Handled above

            const cond = query[key];
            const val = doc[key];

            // Specific handling for Date operators
            if (cond && typeof cond === 'object' && '$lte' in cond) {
                // Check for null/undefined if strictness needed, but JS Date(null) is 1970
                // For robustness: if val is null/undefined, treat as formatted date?
                // Logic: scheduledAt $lte now. val must be a date.
                if (val === undefined || val === null) return false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (new Date(val as any) > new Date((cond as any).$lte)) return false;
            } else if (cond !== undefined && typeof cond !== 'object') {
                // Exact match value
                if (val !== cond) return false;
            }
        }
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async findOneAndUpdate(query: any, update: any) {
        const candidate = mockDb.find(doc => MockModelClass.matches(doc, query));

        if (!candidate) return null;

        // Apply update ($set)
        if (update.$set) {
            Object.assign(candidate, update.$set);
        }

        return candidate;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async updateOne(query: any, update: any) {
        const doc = mockDb.find(d => d._id === query._id);
        if (doc && update.$set) {
            Object.assign(doc, update.$set);
        }
        return { matchedCount: doc ? 1 : 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async deleteMany(query: any) {
        if (Object.keys(query).length === 0) {
            mockDb = [];
        }
        return { deletedCount: 0 };
    }
}

// Inject Mock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
mongoose.models.Task = MockModelClass as any;

describe('MongoTaskScheduler', () => {
    let scheduler: MongoTaskScheduler;

    beforeEach(async () => {
        mockDb = [];
        // Start fresh scheduler
        // Use short poll interval for tests
        scheduler = new MongoTaskScheduler('mongodb://mock', 10, 5000); // 10ms poll
    });

    afterEach(async () => {
        await scheduler.stop();
    });

    it('should schedule and execute a task (Happy Path)', async () => {
        let handledPayload: JsonValue = null as JsonValue;
        const promise = new Promise<void>(resolve => {
            scheduler.registerHandler('test-task', async (payload: JsonValue) => {
                handledPayload = payload;
                resolve();
            });
        });

        await scheduler.scheduleTask('test-task', { foo: 'bar' });

        await scheduler.start();
        await promise; // Wait for handler

        // Wait for async markAsSuccess
        await new Promise(r => setTimeout(r, 50));

        expect(handledPayload).toEqual({ foo: 'bar' });

        // Verify status is SUCCESS
        const task = mockDb[0];
        expect(task.status).toBe(TaskStatus.SUCCESS);
    });

    it('should retry a failed task with backoff', async () => {
        let attempts = 0;
        const promise = new Promise<void>(resolve => {
            scheduler.registerHandler('fail-task', async () => {
                attempts++;
                if (attempts === 1) throw new Error('First fail');
                resolve();
            });
        });

        // Override schedule date to now
        await scheduler.scheduleTask('fail-task', { data: 1 }, {
            retryPolicy: { maxRetries: 2, initialDelayMinutes: 0.001 } // Short delay
        });




        await scheduler.start();

        await promise;

        // Wait for async markAsSuccess
        await new Promise(r => setTimeout(r, 50));

        expect(attempts).toBe(2);
        expect(mockDb[0].status).toBe(TaskStatus.SUCCESS);
        expect(mockDb[0].retryCount).toBe(1);
    });

    it('should mark task as failed task after max retries (Terminal Failure)', async () => {
        let attempts = 0;
        // We need to wait for 2 failures.
        const signal = new Promise<void>(resolve => {
            const interval = setInterval(() => {
                if (mockDb[0]?.status === TaskStatus.FAILED) {
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        });

        scheduler.registerHandler('terminal-task', async () => {
            attempts++;
            throw new Error('Always fail');
        });

        await scheduler.scheduleTask('terminal-task', {}, {
            retryPolicy: { maxRetries: 1, initialDelayMinutes: 0 }
        });

        await scheduler.start();
        await signal;

        expect(attempts).toBe(2); // Initial + 1 retry
        expect(mockDb[0].status).toBe(TaskStatus.FAILED);
        expect(mockDb[0].error).toBe('Always fail');
    });

    it('should prevent multiple workers from claiming the same task (Distributed Locking)', async () => {
        // Setup 2 schedulers
        const scheduler2 = new MongoTaskScheduler('mongodb://mock', 10);

        let handler1Calls = 0;
        let handler2Calls = 0;

        // Use a long task to ensure overlap if locking failing
        const handler = async () => {
            await new Promise(r => setTimeout(r, 100));
            return;
        };

        scheduler.registerHandler('race-task', async () => { handler1Calls++; await handler(); });
        scheduler2.registerHandler('race-task', async () => { handler2Calls++; await handler(); });

        await scheduler.scheduleTask('race-task', {});

        await Promise.all([scheduler.start(), scheduler2.start()]);

        // Wait for task completion
        await new Promise(r => setTimeout(r, 300));

        await scheduler.stop();
        await scheduler2.stop();

        // Only one should have executed
        expect(handler1Calls + handler2Calls).toBe(1);
    });

    it('should recover zombie tasks (expired locks)', async () => {
        // Create a task that is "PENDING" but locked in the past
        const past = new Date(Date.now() - 10000);

        const zombieTask = new MockModelClass({
            type: 'zombie-task',
            payload: {},
            status: TaskStatus.PENDING, // It was running
            scheduledAt: past,
            retryCount: 0,
            retryPolicy: { maxRetries: 3, initialDelayMinutes: 1 },
            workerId: 'dead-worker',
            lockedUntil: past // Expired!
        });
        await zombieTask.save();

        let recovered = false;
        const promise = new Promise<void>(resolve => {
            scheduler.registerHandler('zombie-task', async () => {
                recovered = true;
                resolve();
            });
        });

        await scheduler.start();
        await promise;

        // Wait for async markAsSuccess
        await new Promise(r => setTimeout(r, 50));

        expect(recovered).toBe(true);
        expect(mockDb[0].workerId).not.toBe('dead-worker');
        expect(mockDb[0].status).toBe(TaskStatus.SUCCESS);
    });
});
