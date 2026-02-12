// Re-export core types to maintain compatibility and unification
export * from '../core/ports/TaskScheduler';

// Payloads
export interface SyncUserPendingDocsPayload {
    userId: string;
}

export interface ProcessDocumentIntegrityPayload {
    documentIndex: number;
}

export interface BlockchainPublishPayload {
    documentIndex: number;
    documentHash: string;
}
