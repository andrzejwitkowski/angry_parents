// Frontend mirror of backend domain types
// Keep in sync with backend/src/core/domain/TimelineItem.ts

export type BaseTimelineItem = {
    id: string;
    date: string; // YYYY-MM-DD
    createdAt: string;
    createdBy: string;
    createdByName?: string;
};

export type NoteItem = BaseTimelineItem & {
    type: "NOTE";
    content: string;
};

export type HandoverItem = BaseTimelineItem & {
    type: "HANDOVER";
    location: string;
    time: string; // HH:MM
    status: "PENDING" | "COMPLETED";
};

export type MedsItem = BaseTimelineItem & {
    type: "MEDS";
    medicineName: string;
    dosage: string;
    administered: boolean;
};

export type MedicalVisitItem = BaseTimelineItem & {
    type: "MEDICAL_VISIT";
    doctor: string;
    specialization?: string;
    diagnosis: string;
    recommendations?: string;
    attachments: string[]; // File URLs
};

export type IncidentItem = BaseTimelineItem & {
    type: "INCIDENT";
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
};

export type VacationItem = BaseTimelineItem & {
    type: "VACATION";
    status: string;
};

export type AttachmentItem = BaseTimelineItem & {
    type: "ATTACHMENT";
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
};

// Discriminated union
export type TimelineItem =
    | NoteItem
    | HandoverItem
    | MedsItem
    | MedicalVisitItem
    | IncidentItem
    | VacationItem
    | AttachmentItem;

// DTO for creating new items (without id, createdAt)
export type CreateTimelineItemDto = Omit<TimelineItem, "id" | "createdAt">;
