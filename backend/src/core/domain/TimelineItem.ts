import { z } from "zod";

const AuditEntrySchema = z.object({
    timestamp: z.string().datetime(),
    userId: z.string(),
    userName: z.string().optional(),
    action: z.enum(["CREATED", "UPDATED", "DELETED"]),
    changes: z.any().optional(), // Field name to new value mapping
});

// Base schema for all timeline items (metadata fields)
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
 * This is a mapping from userId to Base64 ciphertext.
 */
export type EncryptedPayload = Record<string, string>;

/**
 * A TimelineItem as it exists in storage (with encrypted content).
 * All sensitive data is contained within `encryptedPayload`.
 */
export type EncryptedTimelineItem = z.infer<typeof BaseTimelineItemSchema> & {
    type: z.infer<typeof TimelineItemTypeSchema>;
    encryption: "ENCRYPTED";
    encryptedPayload: EncryptedPayload;
    ciphertext?: string;
};

// Main type for the backend - only Encrypted items allowed
export type TimelineItem = EncryptedTimelineItem;

export const TimelineItemSchema = BaseTimelineItemSchema.extend({
    encryption: z.literal("ENCRYPTED"),
    type: TimelineItemTypeSchema,
    encryptedPayload: z.record(z.string(), z.string()),
    ciphertext: z.string().optional(),
});

/**
 * Helper type for creating new items on the server side.
 * The client sends unencrypted metadata and the client-side encryptedPayload.
 */
export type CreateTimelineItemDto = {
    type: z.infer<typeof TimelineItemTypeSchema>;
    date: string;
    encryptedPayload: EncryptedPayload;
    childIds: string[];
    createdBy: string;
    createdByName?: string;
};

// Re-export types for backward compatibility where needed
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type BaseTimelineItem = z.infer<typeof BaseTimelineItemSchema>;
// PlainTimelineItem and specific types (NoteItem, etc.) are removed from backend
// as the backend no longer validates or cares about their structure.
export type PlainTimelineItem = any; 
