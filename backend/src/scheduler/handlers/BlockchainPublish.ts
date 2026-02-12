
import { IBlockchainAnchor } from '../../core/ports/IBlockchainAnchor';
import { IForensicRepository } from '../../core/ports/IForensicRepository';
import { BlockchainPublishPayload } from '../types';
import { SystemState } from '../../core/domain/forensic/SystemState';

export const createBlockchainPublishHandler = (
    forensicRepo: IForensicRepository,
    blockchain: IBlockchainAnchor
) => async (payload: BlockchainPublishPayload): Promise<void> => {
    console.log(`[BlockchainPublish] Processing document ${payload.documentIndex}...`);

    const doc = await forensicRepo.getDocumentByIndex(payload.documentIndex);
    if (!doc) {
        // If doc is missing, we can't publish.
        // Retrying assumes eventual consistency.
        throw new Error(`Document ${payload.documentIndex} not found during Blockchain Publish.`);
    }

    // Idempotency: Check if already anchored
    if (!doc.blockchainTxId) {
        console.log(`[BlockchainPublish] Anchoring hash ${doc.hash}...`);
        // Simulating network call, task manager handles timeout/retry
        const txHash = await blockchain.anchorHash(doc.hash);

        doc.blockchainTxId = txHash;
        // Save checkpoint 1: TxId obtained
        await forensicRepo.saveDocument(doc);
        console.log(`[BlockchainPublish] Anchored. TxId: ${txHash}`);
    } else {
        console.log(`[BlockchainPublish] Already anchored. TxId: ${doc.blockchainTxId}`);
    }

    // Finalize Status
    if (doc.status !== 'FINALIZED') {
        doc.status = 'FINALIZED';
        await forensicRepo.saveDocument(doc);
        console.log(`[BlockchainPublish] Document ${doc.index} FINALIZED.`);
    }

    // Update System State
    // We must ensure the system state reflects this finalized document as the "Head"
    const state = await forensicRepo.getSystemState();
    if (!state || state.totalDocs <= doc.index) {
        const newState: SystemState = {
            totalDocs: doc.index + 1,
            lastFinalHash: doc.hash,
            updatedAt: new Date().toISOString(),
            signatures: state?.signatures || []
        };
        await forensicRepo.saveSystemState(newState);
        console.log(`[BlockchainPublish] System State updated. Head Index: ${doc.index}`);
    }
};
