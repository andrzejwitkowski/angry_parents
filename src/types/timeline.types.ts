// Frontend mirror of backend domain types
// Keep in sync with backend/src/core/domain/TimelineItem.ts

export type AuditEntry = {
    timestamp: string;
    userId: string;
    userName?: string;
    action: "CREATED" | "UPDATED" | "DELETED";
    changes?: Record<string, unknown>;
};

export type BaseTimelineItem = {
    id: string;
    date: string; // YYYY-MM-DD
    createdAt: string;
    createdBy: string;
    createdByName?: string;
    auditTrail: AuditEntry[];
    isDeleted: boolean;
    childIds: string[];
};

export type NoteItem = BaseTimelineItem & {
    type: "NOTE";
    encryption: "PLAINTEXT";
    content: string;
};

export type HandoverItem = BaseTimelineItem & {
    type: "HANDOVER";
    encryption: "PLAINTEXT";
    location: string;
    time: string; // HH:MM
    status: "PENDING" | "COMPLETED";
};

export type MedsItem = BaseTimelineItem & {
    type: "MEDS";
    encryption: "PLAINTEXT";
    medicineName: string;
    dosage: string;
    administered: boolean;
};

export type MedicalVisitItem = BaseTimelineItem & {
    type: "MEDICAL_VISIT";
    encryption: "PLAINTEXT";
    doctor: string;
    specialization?: string;
    diagnosis: string;
    recommendations?: string;
    attachments: string[]; // File URLs
};

export type IncidentItem = BaseTimelineItem & {
    type: "INCIDENT";
    encryption: "PLAINTEXT";
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
};

export type VacationItem = BaseTimelineItem & {
    type: "VACATION";
    encryption: "PLAINTEXT";
    status: string;
};

export type AttachmentItem = BaseTimelineItem & {
    type: "ATTACHMENT";
    encryption: "PLAINTEXT";
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
};

export type TimelineItemType =
    | "NOTE"
    | "HANDOVER"
    | "MEDS"
    | "MEDICAL_VISIT"
    | "INCIDENT"
    | "VACATION"
    | "ATTACHMENT";

export type PlainTimelineItem =
    | NoteItem
    | HandoverItem
    | MedsItem
    | MedicalVisitItem
    | IncidentItem
    | VacationItem
    | AttachmentItem;

/**
 * Represents an item that is explicitly encrypted.
 */
export type EncryptedTimelineItem = BaseTimelineItem & {
    type: TimelineItemType;
    encryption: "ENCRYPTED";
    encryptedPayload: Record<string, string>;
    ciphertext?: string; // Encrypted ciphertext for this user, from API
};

// Discriminated union
export type TimelineItem = PlainTimelineItem | EncryptedTimelineItem;

// DTO for creating new items (now strictly requiring encryption field)
export type CreateTimelineItemDto =
    | (Omit<PlainTimelineItem, "id" | "createdAt" | "auditTrail" | "isDeleted" | "encryption"> & { encryption: "PLAINTEXT" })
    | {
        type: TimelineItemType;
        date: string;
        encryption: "ENCRYPTED";
        encryptedPayload: Record<string, string>;
    };

export type CreateTimelineItemInput = {
    type: TimelineItemType;
    date: string;
    childId: string;
    encryption: "PLAINTEXT";
    idempotencyKey?: string;
    createdBy?: string;
    childIds?: string[];
    [key: string]: unknown;
};

export type UpdateTimelineItemDto = Partial<CreateTimelineItemDto>;

export type EventProofStatus = "CLAIMED" | "SUBMITTED" | "RECONCILING" | "CONFIRMED" | "FAILED";

export type EventProof =
    | {
        status: "CLAIMED" | "SUBMITTED" | "RECONCILING" | "FAILED";
        hash: string;
        submittedTxHash?: string;
        lastAttemptAt?: string;
        lastError?: string;
    }
    | {
        status: "CONFIRMED";
        hash: string;
        txHash: string;
        blockNumber: string;
    };
