import mongoose, { Schema, Document } from 'mongoose';
import type { ScheduleRule } from '../core/domain/child/ScheduleRule';

export interface ScheduleRuleDocument extends Omit<ScheduleRule, 'id'>, Document {
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
    timestamps: true, // adds createdAt and updatedAt to mongo doc, though we also have explicit createdAt string
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    minimize: false // prevents mongoose from removing empty objects in config, if any
});

export const ScheduleRuleModel = mongoose.model<ScheduleRuleDocument>('ScheduleRule', scheduleRuleSchema);
