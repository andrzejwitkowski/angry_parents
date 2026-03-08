import mongoose, { Schema, Document } from "mongoose";
import type { Passkey } from "../../../domain/auth/model/Passkey";

export interface PasskeyDocument extends Omit<Passkey, "credentialID" | "credentialPublicKey">, Document {
    credentialID: Buffer;
    credentialPublicKey: Buffer;
}

const passkeySchema = new Schema<PasskeyDocument>({
    userId: { type: String, required: true, index: true },
    webauthnUserId: { type: String, required: true },
    credentialID: { type: Buffer, required: true, unique: true },
    credentialPublicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true },
    transports: { type: [String], required: false },
    createdAt: { type: Date, required: true, default: Date.now },
    name: { type: String, required: true }
}, {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

export const PasskeyModel = mongoose.model<PasskeyDocument>("Passkey", passkeySchema);
