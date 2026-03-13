
import { describe, it, expect, beforeAll, afterAll, afterEach, mock } from 'bun:test';
import { TaskManager } from '../TaskManager';
import { TaskType, SyncUserPendingDocsPayload, BlockchainPublishPayload } from '../types';
import { createSyncUserPendingDocsHandler } from '../handlers/SyncUserPendingDocs';
import { createProcessDocumentIntegrityHandler } from '../handlers/ProcessDocumentIntegrity';
import { createBlockchainPublishHandler } from '../handlers/BlockchainPublish';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { IForensicRepository } from '../../domain/forensic/ports/IForensicRepository';
import { ICryptoService } from '../../domain/shared/ports/ICryptoService';
import { PasskeyRepository } from '../../domain/auth/ports/PasskeyRepository';
import { IBlockchainAnchor } from '../../domain/shared/ports/IBlockchainAnchor';
import { ForensicDocument } from '../../domain/forensic/model/ForensicDocument';
import { SystemState } from '../../domain/forensic/model/SystemState';
import { Passkey } from '../../domain/auth/model/Passkey';
import { ObservabilityService } from '../../domain/shared/ports/ObservabilityService';
import { MongoTimelineRepository } from '../../adapters/mongo/repositories/events/MongoTimelineRepository';
import { TimelineEventProofService } from '../../domain/events/service/TimelineEventProofService';
import type { EncryptedTimelineItem } from '../../domain/events/model/TimelineItem';
import { createReconcileEventProofHandler } from '../handlers/ReconcileEventProof';
import { connectMongoMemory, disconnectMongoMemory } from '../../adapters/mongo/__tests__/mongoMemoryServer';

// --- Mocks ---

class MockObservabilityService implements ObservabilityService {
    trackTimeout(): void { }
    log(): void { }
}

class MockForensicRepository implements IForensicRepository {
    public docs: ForensicDocument<unknown>[] = [];
    public systemState: SystemState | null = null;

    async saveDocument<T>(doc: ForensicDocument<T>): Promise<void> {
        const existingIndex = this.docs.findIndex(d => d.index === doc.index);
        if (existingIndex >= 0) {
            this.docs[existingIndex] = doc;
        } else {
            this.docs.push(doc);
        }
    }

    async getDocumentByIndex<T>(index: number): Promise<ForensicDocument<T> | null> {
        return (this.docs.find(d => d.index === index) as ForensicDocument<T>) || null;
    }

    async getLastFinalizedDocument<T>(): Promise<ForensicDocument<T> | null> {
        return (this.docs.filter(d => d.status === 'FINALIZED').sort((a, b) => b.index - a.index)[0] as ForensicDocument<T>) || null;
    }

    async getAllDocuments<T>(): Promise<ForensicDocument<T>[]> {
        return this.docs as ForensicDocument<T>[];
    }

    async getLastDocument<T>(): Promise<ForensicDocument<T> | null> {
        return (this.docs.sort((a, b) => b.index - a.index)[0] as ForensicDocument<T>) || null;
    }

    async getSystemState(): Promise<SystemState | null> {
        return this.systemState;
    }

    async saveSystemState(state: SystemState): Promise<void> {
        this.systemState = state;
    }
}

class MockCryptoService implements ICryptoService {
    async verifySignature(): Promise<boolean> {
        // Simplified mock: accept signature if it equals "SIGNATURE_FOR_" + data (roughly) or valid
        // Or specific test logic.
        return true;
    }

    async encryptRSA(): Promise<string> {
        return "mock-encrypted";
    }

    async getFingerprint(): Promise<string> {
        return "mock-fingerprint";
    }
}

class MockPasskeyRepository implements PasskeyRepository {
    public passkeys: Passkey[] = [];

    async save(passkey: Passkey): Promise<void> {
        this.passkeys.push(passkey);
    }

    async findByUserId(userId: string): Promise<Passkey[]> {
        return this.passkeys.filter(p => p.userId === userId);
    }

    async findByCredentialID(credentialID: Uint8Array): Promise<Passkey | null> {
        // Should compare bytes
        return this.passkeys.find(p => Buffer.compare(Buffer.from(p.credentialID), Buffer.from(credentialID)) === 0) || null;
    }

    async countByUserId(): Promise<number> {
        return 0;
    }

    async updateCounter(): Promise<void> {
    }
}

class MockBlockchainAnchor implements IBlockchainAnchor {
    async anchorHash(hash: string): Promise<string> {
        return `TX_HASH_${hash}`;
    }

    async verifyAnchor(hash: string, txHash: string): Promise<boolean> {
        return txHash === `TX_HASH_${hash}`;
    }
}

function buildEncryptedTimelineItem(): EncryptedTimelineItem {
    return {
        id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
        type: "NOTE",
        date: "2026-03-10",
        createdAt: "2026-03-10T10:30:00.000Z",
        createdBy: "dad-1",
        createdByName: "Alice",
        auditTrail: [{
            timestamp: "2026-03-10T10:30:00.000Z",
            userId: "dad-1",
            userName: "Alice",
            action: "CREATED",
        }],
        isDeleted: false,
        childIds: ["child-1"],
        encryption: "ENCRYPTED",
        encryptedPayload: {
            "dad-1": "ciphertext-v2",
            "mom-1": "ciphertext-v2-mom",
        },
        eventVersion: 2,
        versionHistory: [
            {
                version: 1,
                snapshot: {
                    id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
                    type: "NOTE",
                    date: "2026-03-10",
                    createdAt: "2026-03-10T10:30:00.000Z",
                    createdBy: "dad-1",
                    createdByName: "Alice",
                    auditTrail: [{
                        timestamp: "2026-03-10T10:30:00.000Z",
                        userId: "dad-1",
                        userName: "Alice",
                        action: "CREATED",
                    }],
                    isDeleted: false,
                    childIds: ["child-1"],
                    encryption: "ENCRYPTED",
                    encryptedPayload: {
                        "dad-1": "ciphertext-v1",
                        "mom-1": "ciphertext-v1-mom",
                    },
                },
                proofHistory: [],
            },
            {
                version: 2,
                snapshot: {
                    id: "6f133670-8d3a-4f53-a033-0f2da65e45d2",
                    type: "NOTE",
                    date: "2026-03-10",
                    createdAt: "2026-03-10T10:30:00.000Z",
                    createdBy: "dad-1",
                    createdByName: "Alice",
                    auditTrail: [{
                        timestamp: "2026-03-10T10:30:00.000Z",
                        userId: "dad-1",
                        userName: "Alice",
                        action: "CREATED",
                    }],
                    isDeleted: false,
                    childIds: ["child-1"],
                    encryption: "ENCRYPTED",
                    encryptedPayload: {
                        "dad-1": "ciphertext-v2",
                        "mom-1": "ciphertext-v2-mom",
                    },
                },
                proofHistory: [],
            },
        ],
    };
}

// --- Tests ---

describe('Task Scheduler & Integrity Pipeline', () => {
    let mongoServer: MongoMemoryServer;
    let taskManager: TaskManager;
    let mockRepo: MockForensicRepository;
    let mockCrypto: MockCryptoService;
    let mockPasskeyRepo: MockPasskeyRepository;
    let mockBlockchain: MockBlockchainAnchor;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    afterEach(async () => {
        // Clear tasks
        await mongoose.connection.db?.collection('tasks').deleteMany({});
        await taskManager?.stop();
    });

    it('Duplicate Prevention: Verify strict deduplication for same payload', async () => {
        taskManager = new TaskManager(new MockObservabilityService(), 100);
        // Ensure indexes are built before testing constraints
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (taskManager as any).model.ensureIndexes();

        const payload = { userId: 'user-123' };

        // Schedule first task
        const task1 = await taskManager.schedule<SyncUserPendingDocsPayload>(
            TaskType.SYNC_USER_PENDING_DOCS,
            payload
        );

        // Schedule duplicate task
        const task2 = await taskManager.schedule<SyncUserPendingDocsPayload>(
            TaskType.SYNC_USER_PENDING_DOCS,
            payload
        );

        // Should return SAME task ID
        expect(task1.id).toBeDefined();
        expect(task1.id).toBe(task2.id);

        // Verify only ONE task in DB (excluding completed/failed if implemented differently, but here active)
        const count = await mongoose.connection.db?.collection('tasks').countDocuments({});
        expect(count).toBe(1);
    });

    it('uses an injected failure handler when reconciliation retries are exhausted', async () => {
        taskManager = new TaskManager(new MockObservabilityService(), 50);
        const failureHandler = mock(async () => {});
        taskManager.registerFailureHandler(TaskType.RECONCILE_EVENT_PROOF, failureHandler as any);

        taskManager.registerHandler(TaskType.RECONCILE_EVENT_PROOF, async () => {
            throw new Error('receipt lookup exhausted');
        });

        await taskManager.schedule(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: 'item-123', version: 2, submittedTxHash: '0xabc' },
            { retryPolicy: { maxRetries: 0, initialDelayMinutes: 1 } }
        );

        await taskManager.start();
        await new Promise(r => setTimeout(r, 250));

        expect(failureHandler).toHaveBeenCalledWith(
            { itemId: 'item-123', version: 2, submittedTxHash: '0xabc' },
            'receipt lookup exhausted'
        );
    });

    it('Full Pipeline Flow: Sync -> Integrity -> Blockchain', async () => {
        // Setup Mocks
        mockRepo = new MockForensicRepository();
        mockCrypto = new MockCryptoService();
        mockPasskeyRepo = new MockPasskeyRepository();
        mockBlockchain = new MockBlockchainAnchor();
        taskManager = new TaskManager(new MockObservabilityService(), 50); // fast polling

        // --- Setup Data ---
        const userId = "user-123";
        const keyIdBase64 = "keyid123";
        const keyIdBuffer = Buffer.from(keyIdBase64, 'base64');
        // const docHash = "123hash";

        // 1. Create a Passkey for User
        await mockPasskeyRepo.save({
            userId,
            webauthnUserId: "webid",
            credentialID: keyIdBuffer,
            credentialPublicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            createdAt: new Date(),
            name: "My Key",
            transports: []
        });

        // 2. Create a Pending Document with 2 signatures (Ready for Integrity)
        const doc = new ForensicDocument<unknown>(
            1,
            { someContext: "foo" },
            "prevHash",
            new Date().toISOString()
        );
        doc.hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // Valid hash for empty content? No. 
        // We need a valid hash for integrity check.
        // Let's rely on `calculatePayloadHash` or update doc.hash to match what Process handler computes.
        // Wait, `calculatePayloadHash` is deterministic based on `toPayload()`.
        // Let's pre-calculate or let test fail and adjust?
        // Better: import `calculatePayloadHash` and set it.
        // But I can't easily import it inside `describe` scope or from utils.
        // I'll assume mockRepo stores what I give.
        // The HANDLER will check validity.
        // So I must provide a VALID HASH.
        // Or mock `calculatePayloadHash`? No, I want integration test.
        // I will import `calculatePayloadHash` in test file above.

        // 3. Add Signatures
        doc.signatures.push({
            signerId: userId,
            signature: "sig1",
            timestamp: new Date().toISOString(),
            keyId: keyIdBase64
        });
        doc.signatures.push({
            signerId: "admin", // Assuming admin signed too? SyncUserPendingDocs just checks if count >= 2.
            signature: "sig2",
            timestamp: new Date().toISOString(),
            keyId: keyIdBase64 // Reuse key for simplicity (mock passkey repo has it)
        });

        // Compute strict hash
        // We need `calculatePayloadHash` imported
        const { calculatePayloadHash } = await import('../utils/crypto');
        doc.hash = calculatePayloadHash(doc.toPayload());

        await mockRepo.saveDocument(doc);


        // --- Register Handlers ---
        taskManager.registerHandler(
            TaskType.SYNC_USER_PENDING_DOCS,
            createSyncUserPendingDocsHandler(mockRepo, taskManager)
        );
        taskManager.registerHandler(
            TaskType.PROCESS_DOCUMENT_INTEGRITY,
            createProcessDocumentIntegrityHandler(mockRepo, mockCrypto, mockPasskeyRepo, taskManager)
        );
        taskManager.registerHandler(
            TaskType.BLOCKCHAIN_PUBLISH,
            createBlockchainPublishHandler(mockRepo, mockBlockchain)
        );

        // --- Start Scheduler ---
        await taskManager.start();

        // --- Trigger Sync Task ---
        await taskManager.schedule<SyncUserPendingDocsPayload>(
            TaskType.SYNC_USER_PENDING_DOCS,
            { userId }
        );

        // --- Wait & Verify ---
        // Wait for eventual completion. 
        // Sync -> (creates Integrity Task) -> Integrity -> (creates Blockchain Task) -> Blockchain -> Finalized.

        // We can poll mockRepo state.
        const maxWait = 2000;
        const start = Date.now();
        let finalized = false;

        while (Date.now() - start < maxWait) {
            const d = await mockRepo.getDocumentByIndex(1);
            if (d && d.status === 'FINALIZED' && d.blockchainTxId) {
                finalized = true;
                break;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        expect(finalized).toBe(true);
        const finalDoc = await mockRepo.getDocumentByIndex(1);
        expect(finalDoc?.blockchainTxId).toBe(`TX_HASH_${finalDoc?.hash}`);

        // Check System State
        const state = await mockRepo.getSystemState();
        expect(state?.totalDocs).toBe(2); // Index + 1
        expect(state?.lastFinalHash).toBe(finalDoc?.hash);
    });

    it('Idempotency & Failure Recovery: Simulate network failure', async () => {
        // Setup
        mockRepo = new MockForensicRepository();
        mockCrypto = new MockCryptoService();
        mockPasskeyRepo = new MockPasskeyRepository();
        mockBlockchain = new MockBlockchainAnchor();
        taskManager = new TaskManager(new MockObservabilityService(), 50);

        // Document Ready for Blockchain
        const doc = new ForensicDocument(2, { data: "test" }, "prev", new Date().toISOString());
        const { calculatePayloadHash } = await import('../utils/crypto');
        doc.hash = calculatePayloadHash(doc.toPayload());
        doc.status = 'PENDING';
        await mockRepo.saveDocument(doc);

        // Helper to fail once
        let shouldFail = true;
        const faultyBlockchain = {
            anchorHash: async (hash: string) => {
                if (shouldFail) {
                    shouldFail = false;
                    throw new Error("Simulated Network Error");
                }
                return `TX_RETRY_${hash}`;
            },
            verifyAnchor: async () => true
        };

        taskManager.registerHandler(
            TaskType.BLOCKCHAIN_PUBLISH,
            createBlockchainPublishHandler(mockRepo, faultyBlockchain as IBlockchainAnchor)
        );

        await taskManager.start();

        // Schedule Task
        await taskManager.schedule<BlockchainPublishPayload>(
            TaskType.BLOCKCHAIN_PUBLISH,
            { documentIndex: 2, documentHash: doc.hash },
            { retryPolicy: { maxRetries: 3, initialDelayMinutes: 0.1 / 60 } } // fast retry (0.1 sec)
        );

        // Wait
        const maxWait = 3000;
        const start = Date.now();
        let finalized = false;

        while (Date.now() - start < maxWait) {
            const d = await mockRepo.getDocumentByIndex(2);
            if (d && d.status === 'FINALIZED') {
                finalized = true;
                break;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        expect(finalized).toBe(true);
        const finalDoc = await mockRepo.getDocumentByIndex(2);
        expect(finalDoc?.blockchainTxId).toBe(`TX_RETRY_${finalDoc?.hash}`);

        // Verify task stats
        // We can't access task model directly easily if private, but we can assume success if logic ran.
    });
    it('Distributed Locking: Prevent multiple workers from claiming the same task', async () => {
        // Setup 2 schedulers
        const scheduler1 = new TaskManager(new MockObservabilityService(), 10);
        const scheduler2 = new TaskManager(new MockObservabilityService(), 10);

        let handler1Calls = 0;
        let handler2Calls = 0;

        // Use a long task to ensure overlap if locking failing
        const handler = async () => {
            await new Promise(r => setTimeout(r, 100)); // Simulate work
        };

        scheduler1.registerHandler(TaskType.SYNC_USER_PENDING_DOCS, async () => { handler1Calls++; await handler(); });
        scheduler2.registerHandler(TaskType.SYNC_USER_PENDING_DOCS, async () => { handler2Calls++; await handler(); });

        await scheduler1.schedule(TaskType.SYNC_USER_PENDING_DOCS, { userId: 'race-user' });

        await Promise.all([scheduler1.start(), scheduler2.start()]);

        // Wait for task completion
        await new Promise(r => setTimeout(r, 500));

        await scheduler1.stop();
        await scheduler2.stop();

        // Only one should have executed
        expect(handler1Calls + handler2Calls).toBe(1);
    });

    it('Zombie Recovery: Pick up tasks with expired locks', async () => {
        taskManager = new TaskManager(new MockObservabilityService(), 10);
        let recovered = false;

        taskManager.registerHandler(TaskType.SYNC_USER_PENDING_DOCS, async () => {
            recovered = true;
        });

        // Insert Zombie Task
        const past = new Date(Date.now() - 10000);
        const { calculatePayloadHash } = await import('../utils/crypto');
        const payload = { userId: 'zombie-user' };

        await mongoose.connection.db?.collection('tasks').insertOne({
            type: TaskType.SYNC_USER_PENDING_DOCS,
            payload,
            payloadHash: calculatePayloadHash(payload),
            status: 'PENDING',
            scheduledAt: past,
            retryCount: 0,
            retryPolicy: { maxRetries: 3, initialDelayMinutes: 1 },
            workerId: 'dead-worker',
            lockedUntil: past, // Expired
            createdAt: past,
            updatedAt: past
        });

        await taskManager.start();

        // Wait
        await new Promise(r => setTimeout(r, 200));

        expect(recovered).toBe(true);
        const task = await mongoose.connection.db?.collection('tasks').findOne({ 'payload.userId': 'zombie-user' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((task as any).status).toBe('COMPLETED');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((task as any).workerId).not.toBe('dead-worker');
    });

    it('marks proof as FAILED when reconciliation task exhausts retries', async () => {
        taskManager = new TaskManager(new MockObservabilityService(), 10);
        const timelineRepository = new MongoTimelineRepository();
        const timelineItem = buildEncryptedTimelineItem();
        await timelineRepository.save(timelineItem as any);

        const proofService = new TimelineEventProofService(
            timelineRepository,
            {
                submitHash: async () => "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                waitForPublication: async () => { throw new Error('receipt delayed'); },
                getReceipt: async () => null,
                publishHash: async () => { throw new Error('not used'); },
            },
            { getNow: () => new Date('2026-03-10T12:00:00.000Z'), getIsoString: () => '2026-03-10T12:00:00.000Z' },
        );

        await proofService.publishProof('6f133670-8d3a-4f53-a033-0f2da65e45d2');

        const { EventProofReconciliationService } = await import('../../domain/events/service/EventProofReconciliationService');
        const reconcileHandler = createReconcileEventProofHandler(new EventProofReconciliationService(
            timelineRepository,
            {
                submitHash: async () => { throw new Error('not used'); },
                waitForPublication: async () => { throw new Error('not used'); },
                publishHash: async () => { throw new Error('not used'); },
                getReceipt: async () => null,
            },
            { getNow: () => new Date('2026-03-10T13:00:00.000Z'), getIsoString: () => '2026-03-10T13:00:00.000Z' }
        ));

        taskManager.registerHandler(TaskType.RECONCILE_EVENT_PROOF, reconcileHandler);
        const reconciliationService = new (await import('../../domain/events/service/EventProofReconciliationService')).EventProofReconciliationService(
            timelineRepository,
            {
                submitHash: async () => { throw new Error('not used'); },
                waitForPublication: async () => { throw new Error('not used'); },
                publishHash: async () => { throw new Error('not used'); },
                getReceipt: async () => null,
            },
            { getNow: () => new Date('2026-03-10T13:00:00.000Z'), getIsoString: () => '2026-03-10T13:00:00.000Z' }
        );
        taskManager.registerFailureHandler(
            TaskType.RECONCILE_EVENT_PROOF,
            async (payload, errorMessage) => {
                const typedPayload = payload as { itemId: string; version: number; submittedTxHash?: string };
                await reconciliationService.markProofReconciliationFailed(
                    typedPayload.itemId,
                    typedPayload.version,
                    errorMessage,
                    typedPayload.submittedTxHash
                );
            }
        );

        await taskManager.schedule(
            TaskType.RECONCILE_EVENT_PROOF,
            { itemId: '6f133670-8d3a-4f53-a033-0f2da65e45d2', version: 2 },
            { retryPolicy: { maxRetries: 0, initialDelayMinutes: 1 } }
        );

        await taskManager.start();
        await new Promise(r => setTimeout(r, 200));
        await taskManager.stop();

        const updated = await timelineRepository.findByIdIncludingDeleted('6f133670-8d3a-4f53-a033-0f2da65e45d2');
        expect(updated?.versionHistory[1].proofHistory[0]).toMatchObject({
            status: 'FAILED',
            lastError: 'Event proof receipt not available yet for item 6f133670-8d3a-4f53-a033-0f2da65e45d2 version 2',
        });
    });
});
