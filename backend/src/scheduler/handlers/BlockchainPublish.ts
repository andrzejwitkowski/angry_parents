
import { IBlockchainAnchor } from '../../domain/shared/ports/IBlockchainAnchor';
import { IForensicRepository } from '../../domain/forensic/ports/IForensicRepository';
import { BlockchainPublishPayload } from '../types';
import { SystemState } from '../../domain/forensic/model/SystemState';

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
        let txHash = payload.existingTxHash;

        if (!txHash) {
            console.log(`[BlockchainPublish] Anchoring hash ${doc.hash}...`);
            // Simulating network call, task manager handles timeout/retry
            txHash = await blockchain.anchorHash(doc.hash);
        } else {
            console.log(`[BlockchainPublish] Verifying existing TxHash ${txHash}...`);
            const isMatch = await blockchain.verifyAnchor(doc.hash, txHash);
            if (!isMatch) throw new Error("Provided existingTxHash does not match document hash on-chain!");
        }

        doc.blockchainTxId = txHash;
        // Save checkpoint 1: TxId obtained
        await forensicRepo.saveDocument(doc);
        console.log(`[BlockchainPublish] Anchored/Verified. TxId: ${txHash}`);
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
