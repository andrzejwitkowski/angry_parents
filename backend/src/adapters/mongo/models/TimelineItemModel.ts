import mongoose, { Schema, Document } from "mongoose";
import type { EncryptedTimelineItem } from "../../../domain/events/model/TimelineItem";

export interface TimelineItemDocument extends Omit<EncryptedTimelineItem, "id">, Document {
    id: string;
}

const timelineItemSchema = new Schema<TimelineItemDocument>({
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true, index: true },
    encryption: { type: String, required: true, enum: ["PLAINTEXT", "ENCRYPTED"], index: true },
    date: { type: String, required: true, index: true },
    createdAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: false },
    auditTrail: [Schema.Types.Mixed],
    isDeleted: { type: Boolean, default: false },
    childIds: { type: [String], default: [] }
}, {
    timestamps: { createdAt: false, updatedAt: true },
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

export const TimelineItemModel = mongoose.model<TimelineItemDocument>("TimelineItem", timelineItemSchema);
