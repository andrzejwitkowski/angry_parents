import mongoose, { Document, Schema } from "mongoose";
import type { TaskOutboxRecord } from "../../../domain/shared/ports/TaskOutboxRepository";

export interface TaskOutboxDocument extends Omit<TaskOutboxRecord, "id">, Document {}

const taskOutboxSchema = new Schema<TaskOutboxDocument>({
    taskType: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    payloadHash: { type: String, required: true, index: true },
    retryPolicy: {
        maxRetries: { type: Number, required: false },
        initialDelayMinutes: { type: Number, required: false },
    },
    status: { type: String, enum: ["PENDING", "CLAIMED", "DISPATCHED"], required: true, default: "PENDING", index: true },
    availableAt: { type: Date, required: true, default: Date.now, index: true },
    lockedUntil: { type: Date, default: null },
}, {
    timestamps: true,
});

taskOutboxSchema.index({ status: 1, availableAt: 1, lockedUntil: 1 });
taskOutboxSchema.index({ taskType: 1, payloadHash: 1 }, { unique: true });

export const TaskOutboxModel = mongoose.models.TaskOutbox || mongoose.model<TaskOutboxDocument>("TaskOutbox", taskOutboxSchema);
