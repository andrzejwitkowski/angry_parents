import { TaskManager } from '../TaskManager';
import { TaskType, SyncUserPendingDocsPayload, ProcessDocumentIntegrityPayload } from '../types';
import { IForensicRepository } from '../../domain/forensic/ports/IForensicRepository';

export const createSyncUserPendingDocsHandler = (
    forensicRepo: IForensicRepository,
    taskManager: TaskManager
) => async (payload: SyncUserPendingDocsPayload): Promise<void> => {
    console.log(`[SyncUserPendingDocs] Checking pending docs for user ${payload.userId}...`);

    // Optimized: Ideally we should query only pending documents
    // But strictly following the interface, we get all or add a new method.
    // We'll use getAllDocuments and filter in memory for now (assuming low scale or cache).
    // In a real production system, we'd add `getPendingDocuments()` to the repo interface.
    const docs = await forensicRepo.getAllDocuments();

    // Explicitly check for PENDING status
    const pendingDocs = docs.filter(d => d.status === 'PENDING');

    for (const doc of pendingDocs) {
        if (doc.signatures && doc.signatures.length >= 2) {
            console.log(`[SyncUserPendingDocs] Document ${doc.index} has sufficient signatures. Scheduling integrity check...`);

            await taskManager.schedule<ProcessDocumentIntegrityPayload>(
                TaskType.PROCESS_DOCUMENT_INTEGRITY,
                { documentIndex: doc.index },
                {
                    retryPolicy: { maxRetries: 3, initialDelayMinutes: 1 }
                }
            );
        }
    }
};
