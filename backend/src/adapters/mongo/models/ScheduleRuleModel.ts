import mongoose, { Schema, Document } from "mongoose";
import type { ScheduleRule } from "../../../domain/events/model/child/ScheduleRule";

export interface ScheduleRuleDocument extends Omit<ScheduleRule, "id">, Document {
    id: string;
}

const scheduleRuleSchema = new Schema<ScheduleRuleDocument>({
    id: { type: String, required: true, unique: true },
    childId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    priority: { type: Number, required: true, default: 0 },
    isOneTime: { type: Boolean, required: true, default: false },
    createdAt: { type: String, required: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    minimize: false
});

export const ScheduleRuleModel = mongoose.model<ScheduleRuleDocument>("ScheduleRule", scheduleRuleSchema);
