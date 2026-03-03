import type { EncryptedTimelineItem } from "../domain/TimelineItem";

export type ForensicIntentStatus = "PENDING" | "PROCESSING" | "COMPLETED";

export interface ForensicIntentRecord {
    id: string;
    timelineItem: EncryptedTimelineItem;
    signerPublicKey: string;
    signatureBase64: string;
    keyId: string;
    timestamp: string;
    signerId: string;
    status: ForensicIntentStatus;
    retryCount: number;
    lastError?: string;
}

export interface ForensicIntentRepository {
    save(intent: ForensicIntentRecord, session?: unknown): Promise<void>;
    findById(id: string): Promise<ForensicIntentRecord | null>;
    markProcessing(id: string): Promise<boolean>;
    markCompleted(id: string): Promise<void>;
    markRetry(id: string, errorMessage: string): Promise<void>;
}
