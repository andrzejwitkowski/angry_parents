import mongoose, { Document, Schema } from "mongoose";
import type { ForensicIntentRecord } from "../core/ports/ForensicIntentRepository";

export interface ForensicIntentDocument extends Omit<ForensicIntentRecord, "id">, Document {
    id: string;
}

const forensicIntentSchema = new Schema<ForensicIntentDocument>({
    id: { type: String, required: true, unique: true, index: true },
    timelineItem: { type: Schema.Types.Mixed, required: true },
    signerPublicKey: { type: String, required: true },
    signatureBase64: { type: String, required: true },
    keyId: { type: String, required: true },
    timestamp: { type: String, required: true },
    signerId: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "PROCESSING", "COMPLETED"], required: true, default: "PENDING", index: true },
    retryCount: { type: Number, required: true, default: 0 },
    lastError: { type: String, required: false }
}, {
    timestamps: true
});

export const ForensicIntentModel = mongoose.model<ForensicIntentDocument>("ForensicIntent", forensicIntentSchema);
