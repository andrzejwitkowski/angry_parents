import mongoose, { Document, Schema } from "mongoose";
import type { TimelineMutationRequestRecord } from "../../../domain/events/ports/TimelineMutationRequestRepository";

export interface TimelineMutationRequestDocument extends Omit<TimelineMutationRequestRecord, "idempotencyKey">, Document {
    idempotencyKey: string;
}

const timelineMutationRequestSchema = new Schema<TimelineMutationRequestDocument>({
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    operation: { type: String, required: true },
    status: { type: String, enum: ["IN_PROGRESS", "COMPLETED", "FAILED"], required: true },
    requestHash: { type: String, required: true },
    timelineItemId: { type: String, required: false },
    lastError: { type: String, required: false },
}, {
    timestamps: true,
});

export const TimelineMutationRequestModel = mongoose.models.TimelineMutationRequest || mongoose.model<TimelineMutationRequestDocument>("TimelineMutationRequest", timelineMutationRequestSchema);
