import { z } from "zod";

// Base schema for all timeline items
const BaseTimelineItemSchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    createdAt: z.string().datetime(),
    createdBy: z.string(),
    createdByName: z.string().optional(),
});

// NOTE: Standard text message
export const NoteItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("NOTE"),
    content: z.string().min(1),
});

// HANDOVER: Child exchange logic
export const HandoverItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("HANDOVER"),
    location: z.string().min(1),
    time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
    status: z.enum(["PENDING", "COMPLETED"]),
});

// MEDS: Medicine tracker
export const MedsItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("MEDS"),
    medicineName: z.string().min(1),
    dosage: z.string().min(1),
    administered: z.boolean().default(false),
});

// MEDICAL_VISIT: Critical medical event
export const MedicalVisitItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("MEDICAL_VISIT"),
    doctor: z.string().min(1),
    specialization: z.string().optional(),
    diagnosis: z.string().min(3),
    recommendations: z.string().optional(),
    attachments: z.array(z.string()).default([]), // File URLs
});

// INCIDENT: Reports with severity
export const IncidentItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("INCIDENT"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().min(1),
});

// VACATION: Status indicator
export const VacationItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("VACATION"),
    status: z.string(),
});

// ATTACHMENT: Files
export const AttachmentItemSchema = BaseTimelineItemSchema.extend({
    type: z.literal("ATTACHMENT"),
    fileName: z.string(),
    fileUrl: z.string().url(),
    fileSize: z.number(),
    mimeType: z.string(),
});

// Discriminated union for all timeline item types
export const TimelineItemSchema = z.discriminatedUnion("type", [
    NoteItemSchema,
    HandoverItemSchema,
    MedsItemSchema,
    MedicalVisitItemSchema,
    IncidentItemSchema,
    VacationItemSchema,
    AttachmentItemSchema,
]);

// TypeScript types inferred from Zod schemas
export type BaseTimelineItem = z.infer<typeof BaseTimelineItemSchema>;
export type NoteItem = z.infer<typeof NoteItemSchema>;
export type HandoverItem = z.infer<typeof HandoverItemSchema>;
export type MedsItem = z.infer<typeof MedsItemSchema>;
export type MedicalVisitItem = z.infer<typeof MedicalVisitItemSchema>;
export type IncidentItem = z.infer<typeof IncidentItemSchema>;
export type VacationItem = z.infer<typeof VacationItemSchema>;
export type AttachmentItem = z.infer<typeof AttachmentItemSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

// Helper type for creating new items (without id, createdAt)
export type CreateTimelineItemDto = Omit<TimelineItem, "id" | "createdAt">;
