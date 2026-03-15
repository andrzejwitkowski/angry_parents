import { z } from "zod";

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const EVM_TX_HASH_RE = /^0x[0-9a-f]{64}$/;

export const EventProofStatusSchema = z.enum([
    "CLAIMED",
    "SUBMITTED",
    "CONFIRMED",
    "FAILED",
    "RECONCILING",
]);

const AuditEntrySchema = z.object({
    timestamp: z.string().datetime(),
    userId: z.string(),
    userName: z.string().optional(),
    action: z.enum(["CREATED", "UPDATED", "DELETED"]),
    changes: z.any().optional(), // Field name to new value mapping
});

const TimelineItemTypeSchema = z.enum([
    "NOTE",
    "HANDOVER",
    "MEDS",
    "MEDICAL_VISIT",
    "INCIDENT",
    "VACATION",
    "ATTACHMENT",
]);

function inferLegacyEventProofStatus(proof: {
    txHash?: string;
    blockNumber?: string;
    anchoredAt?: string;
    submittedTxHash?: string;
    lastAttemptAt?: string;
    lastError?: string;
}) {
    if (proof.txHash && proof.blockNumber !== undefined && proof.anchoredAt) {
        return "CONFIRMED" as const;
    }

    if (proof.submittedTxHash) {
        return proof.lastError ? "FAILED" as const : "SUBMITTED" as const;
    }

    return proof.lastError ? "FAILED" as const : "CLAIMED" as const;
}

const EventProofRecordSchema = z.object({
    version: z.number().int().positive(),
    hash: z.string().regex(SHA256_HEX_RE),
    status: EventProofStatusSchema.optional(),
    submittedTxHash: z.string().regex(EVM_TX_HASH_RE).optional(),
    lastAttemptAt: z.string().datetime().optional(),
    lastError: z.string().min(1).optional(),
    txHash: z.string().regex(EVM_TX_HASH_RE).optional(),
    blockNumber: z.string().regex(/^\d+$/).optional(),
    anchoredAt: z.string().datetime().optional(),
}).transform((proof) => ({
    ...proof,
    status: proof.status ?? inferLegacyEventProofStatus(proof),
}));

const EncryptedTimelineVersionSnapshotSchema = z.object({
    id: z.string().uuid(),
    type: TimelineItemTypeSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    createdAt: z.string().datetime(),
    createdBy: z.string(),
    createdByName: z.string().optional(),
    auditTrail: z.array(AuditEntrySchema).default([]),
    isDeleted: z.boolean().default(false),
    childIds: z.array(z.string()).default([]),
    encryption: z.literal("ENCRYPTED"),
    encryptedPayload: z.record(z.string(), z.string()),
    ciphertext: z.string().optional(),
});

const TimelineItemVersionSchema = z.object({
    version: z.number().int().positive(),
    snapshot: EncryptedTimelineVersionSnapshotSchema,
    proofHistory: z.array(EventProofRecordSchema).default([]),
});

// Base schema for all timeline items
const BaseTimelineItemSchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    createdAt: z.string().datetime(),
    createdBy: z.string(),
    createdByName: z.string().optional(),
    auditTrail: z.array(AuditEntrySchema).default([]),
    isDeleted: z.boolean().default(false),
    childIds: z.array(z.string()).default([]),
});

// NOTE: Standard text message
export const NoteItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("NOTE"),
    encryption: z.literal("PLAINTEXT"),
    content: z.string().min(1),
});

// HANDOVER: Child exchange logic
export const HandoverItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("HANDOVER"),
    encryption: z.literal("PLAINTEXT"),
    location: z.string().min(1),
    time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
    status: z.enum(["PENDING", "COMPLETED"]),
});

// MEDS: Medicine tracker
export const MedsItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("MEDS"),
    encryption: z.literal("PLAINTEXT"),
    medicineName: z.string().min(1),
    dosage: z.string().min(1),
    administered: z.boolean().default(false),
});

// MEDICAL_VISIT: Critical medical event
export const MedicalVisitItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("MEDICAL_VISIT"),
    encryption: z.literal("PLAINTEXT"),
    doctor: z.string().min(1),
    specialization: z.string().optional(),
    diagnosis: z.string().min(3),
    recommendations: z.string().optional(),
    attachments: z.array(z.string()).default([]), // File URLs
});

// INCIDENT: Reports with severity
export const IncidentItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("INCIDENT"),
    encryption: z.literal("PLAINTEXT"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().min(1),
});

// VACATION: Status indicator
export const VacationItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("VACATION"),
    encryption: z.literal("PLAINTEXT"),
    status: z.string(),
});

// ATTACHMENT: Files
export const AttachmentItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("ATTACHMENT"),
    encryption: z.literal("PLAINTEXT"),
    fileName: z.string(),
    fileUrl: z.string().url(),
    fileSize: z.number(),
    mimeType: z.string(),
});

// Discriminated union for all plaintext timeline item types
export const PlainTimelineItemSchema = z.discriminatedUnion("type", [
    NoteItemSchema,
    HandoverItemSchema,
    MedsItemSchema,
    MedicalVisitItemSchema,
    IncidentItemSchema,
    VacationItemSchema,
    AttachmentItemSchema,
]);

// Discriminated union for ALL timeline item types (handled manually for better discrimination)
// Note: Zod discriminatedUnion requires a shared literal field. 
// We use 'encryption' as the primary discriminator for narrowing.

// TypeScript types inferred from Zod schemas
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type BaseTimelineItem = z.infer<typeof BaseTimelineItemSchema>;
export type NoteItem = z.infer<typeof NoteItemSchema>;
export type HandoverItem = z.infer<typeof HandoverItemSchema>;
export type MedsItem = z.infer<typeof MedsItemSchema>;
export type MedicalVisitItem = z.infer<typeof MedicalVisitItemSchema>;
export type IncidentItem = z.infer<typeof IncidentItemSchema>;
export type VacationItem = z.infer<typeof VacationItemSchema>;
export type AttachmentItem = z.infer<typeof AttachmentItemSchema>;
export type PlainTimelineItem = z.infer<typeof PlainTimelineItemSchema>;
export type EventProofStatus = z.infer<typeof EventProofStatusSchema>;
export type EventProofRecord = z.infer<typeof EventProofRecordSchema>;
export type EncryptedTimelineVersionSnapshot = z.infer<typeof EncryptedTimelineVersionSnapshotSchema>;
export type TimelineItemVersion = z.infer<typeof TimelineItemVersionSchema>;

// Note: types and schemas are now defined together below

// Discriminated union for ALL timeline item types
// We use 'encryption' as the primary discriminator for narrowing.
export const TimelineItemSchema = z.discriminatedUnion("encryption", [
    PlainTimelineItemSchema,
    z.object({
        encryption: z.literal("ENCRYPTED"),
        id: z.string().uuid(),
        type: TimelineItemTypeSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        createdAt: z.string().datetime(),
        createdBy: z.string(),
        createdByName: z.string().optional(),
        auditTrail: z.array(AuditEntrySchema).default([]),
        isDeleted: z.boolean().default(false),
        childIds: z.array(z.string()).default([]),
        encryptedPayload: z.record(z.string(), z.string()),
        ciphertext: z.string().optional(),
        eventVersion: z.number().int().positive().default(1),
        versionHistory: z.array(TimelineItemVersionSchema).default([]),
    })
]);

// Types inferred from Zod schemas
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type EncryptedTimelineItem = Extract<TimelineItem, { encryption: "ENCRYPTED" }>;

// DTO for creating new items. 
// In a true E2EE system, the client SHOULD provide the encryption: "ENCRYPTED" and payload.
export const CreatePlainTimelineItemDtoSchema = z.object({
    type: TimelineItemTypeSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    childId: z.string(),
    encryption: z.literal("PLAINTEXT"),
    content: z.string().optional(), // used temporarily during transition or for internal tools
}).passthrough();

export const CreateEncryptedTimelineItemDtoSchema = z.object({
    type: TimelineItemTypeSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    childId: z.string(),
    encryption: z.literal("ENCRYPTED"),
    encryptedPayload: z.record(z.string(), z.string()),
});

export const CreateTimelineItemDtoSchema = z.discriminatedUnion("encryption", [
    CreatePlainTimelineItemDtoSchema,
    CreateEncryptedTimelineItemDtoSchema,
]);

export type CreateTimelineItemDto = z.infer<typeof CreateTimelineItemDtoSchema>;

/**
 * Visitor pattern for TimelineItem.
 * Allows operating on different timeline item types without large switch/if-else blocks.
 */
export interface TimelineItemVisitor<R> {
    visitNote(item: NoteItem): R;
    visitHandover(item: HandoverItem): R;
    visitMeds(item: MedsItem): R;
    visitMedicalVisit(item: MedicalVisitItem): R;
    visitIncident(item: IncidentItem): R;
    visitVacation(item: VacationItem): R;
    visitAttachment(item: AttachmentItem): R;
    visitEncrypted(item: EncryptedTimelineItem): R;
}

/**
 * Dispatcher for the TimelineItem Visitor pattern.
 */
export function acceptTimelineItemVisitor<R>(item: TimelineItem, visitor: TimelineItemVisitor<R>): R {
    if (item.encryption === "ENCRYPTED") {
        return visitor.visitEncrypted(item);
    }

    switch (item.type) {
        case "NOTE":
            return visitor.visitNote(item);
        case "HANDOVER":
            return visitor.visitHandover(item);
        case "MEDS":
            return visitor.visitMeds(item);
        case "MEDICAL_VISIT":
            return visitor.visitMedicalVisit(item);
        case "INCIDENT":
            return visitor.visitIncident(item);
        case "VACATION":
            return visitor.visitVacation(item);
        case "ATTACHMENT":
            return visitor.visitAttachment(item);
        default: {
            const _exhaustiveCheck: never = item;
            throw new Error(`Unhandled timeline item type: ${(item as any).type}`);
        }
    }
}
