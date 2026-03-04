import mongoose, { Schema, Document } from "mongoose";

import { t } from "../lib/i18n";

export interface IFamily extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    parentIds: string[];
    parentPublicKeys: {
        parentId: string; // Refers to user ID
        role: "mom" | "dad"; // Explicit role for encryption
        rsaPublicKeyBase64: string; // The parent's RSA-OAEP public key
    }[];
    children: {
        id: string;
        name: string;
        birthDate?: Date;
    }[];
    custodyPatterns: Record<string, unknown>[];
    createdAt: Date;
    updatedAt: Date;
}

const FamilyChildSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    birthDate: { type: Date },
}, { _id: false });

const FamilySchema = new Schema<IFamily>({
    name: { type: String, default: () => t("common.familyDefault") as any },
    parentIds: [{ type: String, ref: "User", default: [] }],
    parentPublicKeys: [
        {
            parentId: { type: String, required: true },
            role: { type: String, enum: ["mom", "dad"], required: true },
            rsaPublicKeyBase64: { type: String, required: true },
        }
    ],
    children: [FamilyChildSchema],
    custodyPatterns: [{ type: Schema.Types.Mixed, default: [] }],
}, {
    timestamps: true,
});

export const Family = mongoose.models.Family || mongoose.model<IFamily>("Family", FamilySchema);
