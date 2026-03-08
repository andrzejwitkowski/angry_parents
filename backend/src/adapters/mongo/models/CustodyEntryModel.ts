import mongoose, { Schema, Document } from "mongoose";
import type { CustodyEntry } from "../../../domain/events/model/child/CustodyEntry";

export interface CustodyEntryDocument extends Omit<CustodyEntry, "id">, Document {
    id: string;
}

const custodyEntrySchema = new Schema<CustodyEntryDocument>({
    id: { type: String, required: true, unique: true },
    childId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true, default: "00:00" },
    endTime: { type: String, required: true, default: "23:59" },
    assignedTo: { type: String, enum: ["MOM", "DAD"], required: true },
    isRecurring: { type: Boolean, required: true, default: false },
    priority: { type: Number, required: true, default: 0 },
    sourceRuleId: { type: String, required: false }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

custodyEntrySchema.index({ childId: 1, date: 1 });

export const CustodyEntryModel = mongoose.model<CustodyEntryDocument>("CustodyEntry", custodyEntrySchema);
