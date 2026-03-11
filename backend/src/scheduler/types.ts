// Re-export core types to maintain compatibility and unification
export * from '../domain/shared/ports/TaskScheduler';

// Payloads
export interface SyncUserPendingDocsPayload {
    userId: string;
}

export interface ProcessDocumentIntegrityPayload {
    documentIndex: number;
    existingTxHash?: string;
}

export interface BlockchainPublishPayload {
    documentIndex: number;
    documentHash: string;
    existingTxHash?: string;
}

export interface ProcessForensicIntentPayload {
    intentId: string;
}

export interface PublishEventProofPayload {
    /** The timeline item ID. Combined with version, this uniquely identifies the anchoring task. */
    itemId: string;
    /** The specific version number to anchor. Prevents anchoring the wrong snapshot on concurrent edits. */
    version: number;
}
