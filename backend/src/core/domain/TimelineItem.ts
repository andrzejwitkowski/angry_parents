import { z } from "zod";

const AuditEntrySchema = z.object({
    timestamp: z.string().datetime(),
    userId: z.string(),
    userName: z.string().optional(),
    action: z.enum(["CREATED", "UPDATED", "DELETED"]),
    changes: z.any().optional(), // Field name to new value mapping
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

export const TimelineItemTypeSchema = z.enum([
    "NOTE",
    "HANDOVER",
    "MEDS",
    "MEDICAL_VISIT",
    "INCIDENT",
    "VACATION",
    "ATTACHMENT",
]);

/**
 * Encrypted payload containing the dual ciphertext for content fields.
 * This replaces the plaintext content fields when saving to MongoDB.
 */
export type EncryptedPayload = Record<string, string>; // userId -> Base64 ciphertext

/**
 * A TimelineItem as it exists in storage (with encrypted content).
 * Plaintext content fields are removed and replaced by `encryptedPayload`.
 */
export type EncryptedTimelineItem = BaseTimelineItem & {
    type: z.infer<typeof TimelineItemTypeSchema>;
    encryption: "ENCRYPTED";
    encryptedPayload: EncryptedPayload;
    ciphertext?: string;
};

export type TimelineItem = PlainTimelineItem | EncryptedTimelineItem;

export const TimelineItemSchema = z.union([
    PlainTimelineItemSchema,
    z.object({
        encryption: z.literal("ENCRYPTED"),
        // Basic fields for validation before narrowing by type
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
    })
]);

// Helper type for creating new items (without id, createdAt, auditTrail, isDeleted, and encryption)
export type CreateTimelineItemDto = Omit<PlainTimelineItem, "id" | "createdAt" | "auditTrail" | "isDeleted" | "encryption">;
