import mongoose, { Schema, Document } from "mongoose";

import { t } from "../lib/i18n";

export interface IFamily extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    parentIds: string[];
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
    children: [FamilyChildSchema],
    custodyPatterns: [{ type: Schema.Types.Mixed, default: [] }],
}, {
    timestamps: true,
});

export const Family = mongoose.models.Family || mongoose.model<IFamily>("Family", FamilySchema);
