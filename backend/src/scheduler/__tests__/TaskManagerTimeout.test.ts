import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { TaskManager } from '../TaskManager';
import { TaskStatus, TaskType } from '../types';
import mongoose from 'mongoose';
import { ObservabilityService } from '../../domain/shared/ports/ObservabilityService';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoMemory, disconnectMongoMemory } from '../../adapters/mongo/__tests__/mongoMemoryServer';

class MockObservability implements ObservabilityService {
    public timeouts: { taskType: string; taskId: string; metadata: any }[] = [];
    public logs: { level: string; msg: string; context?: any }[] = [];

    trackTimeout(taskType: string, taskId: string, metadata: any): void {
        this.timeouts.push({ taskType, taskId, metadata });
    }

    log(level: 'info' | 'warn' | 'error', msg: string, context?: any): void {
        this.logs.push({ level, msg, context });
    }
}

describe('TaskManager Timeout Logic', () => {
    let mongoServer: MongoMemoryServer;
    let taskManager: TaskManager;
    let mockObservability: MockObservability;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    afterEach(async () => {
        await mongoose.connection.db?.collection('tasks').deleteMany({});
        await taskManager?.stop();
    });

    it('should mark processing task as TIMED_OUT if it exceeds TTL', async () => {
        mockObservability = new MockObservability();
        // Fast polling for test
        taskManager = new TaskManager(mockObservability, 100);

        const { calculatePayloadHash } = await import('../utils/crypto');
        const payload = { test: 'data' };

        // Insert a task that is already PROCESSING and started 15 minutes ago
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const taskId = new mongoose.Types.ObjectId();

        await mongoose.connection.db?.collection('tasks').insertOne({
            _id: taskId,
            type: TaskType.SYNC_USER_PENDING_DOCS,
            payload,
            payloadHash: calculatePayloadHash(payload),
            status: TaskStatus.PROCESSING,
            scheduledAt: fifteenMinutesAgo,
            retryCount: 0,
            retryPolicy: { maxRetries: 3, initialDelayMinutes: 5 },
            workerId: 'worker-1',
            lockedUntil: new Date(Date.now() + 5000),
            processingStartedAt: fifteenMinutesAgo,
            timeoutMinutes: 10, // 10 minute TTL
            createdAt: fifteenMinutesAgo,
            updatedAt: fifteenMinutesAgo
        });

        // Register a no-op handler so it doesn't crash if it tries to process
        taskManager.registerHandler(TaskType.SYNC_USER_PENDING_DOCS, async () => { });

        // Start task manager - it should detect and mark timeout
        await taskManager.start();

        // Wait for polling loop
        await new Promise(r => setTimeout(r, 300));

        const updatedTask = await mongoose.connection.db?.collection('tasks').findOne({ _id: taskId });
        expect(updatedTask?.status).toBe(TaskStatus.TIMED_OUT);

        // Verify observability was called
        expect(mockObservability.timeouts.length).toBe(1);
        expect(mockObservability.timeouts[0].taskType).toBe(TaskType.SYNC_USER_PENDING_DOCS);
        expect(mockObservability.timeouts[0].taskId).toBe(taskId.toString());
    });

    it('should NOT mark processing task as TIMED_OUT if it is within TTL', async () => {
        mockObservability = new MockObservability();
        taskManager = new TaskManager(mockObservability, 100);

        const { calculatePayloadHash } = await import('../utils/crypto');
        const payload = { test: 'data-2' };

        // Insert a task that is PROCESSING but started only 1 minute ago
        const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
        const taskId = new mongoose.Types.ObjectId();

        await mongoose.connection.db?.collection('tasks').insertOne({
            _id: taskId,
            type: TaskType.SYNC_USER_PENDING_DOCS,
            payload,
            payloadHash: calculatePayloadHash(payload),
            status: TaskStatus.PROCESSING,
            scheduledAt: oneMinuteAgo,
            retryCount: 0,
            retryPolicy: { maxRetries: 3, initialDelayMinutes: 5 },
            workerId: 'worker-1',
            lockedUntil: new Date(Date.now() + 5000),
            processingStartedAt: oneMinuteAgo,
            timeoutMinutes: 10, // 10 minute TTL
            createdAt: oneMinuteAgo,
            updatedAt: oneMinuteAgo
        });

        taskManager.registerHandler(TaskType.SYNC_USER_PENDING_DOCS, async () => { });

        await taskManager.start();
        await new Promise(r => setTimeout(r, 300));

        const updatedTask = await mongoose.connection.db?.collection('tasks').findOne({ _id: taskId });
        expect(updatedTask?.status).toBe(TaskStatus.PROCESSING);
        expect(mockObservability.timeouts.length).toBe(0);
    });
});
