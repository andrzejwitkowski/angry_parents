import mongoose, { Schema, Document } from 'mongoose';
import type { TimelineItem } from '../core/domain/TimelineItem';

export interface TimelineItemDocument extends Omit<TimelineItem, 'id'>, Document {
    id: string;
}

// We use a flexible schema for timeline items because they differ greatly by type.
// Zod already validates them at the service layer.
const timelineItemSchema = new Schema<TimelineItemDocument>({
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    createdAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: false },
    auditTrail: [Schema.Types.Mixed],
    isDeleted: { type: Boolean, default: false },
    childIds: { type: [String], default: [] }
}, {
    timestamps: true,
    strict: false, // By setting strict: false, Mongoose saves properties not defined in the schema
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

export const TimelineItemModel = mongoose.model<TimelineItemDocument>('TimelineItem', timelineItemSchema);
