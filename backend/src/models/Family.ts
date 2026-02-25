import mongoose, { Schema, Document } from "mongoose";

export interface IFamily extends Document {
    _id: mongoose.Types.ObjectId;
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
    parentIds: [{ type: String, ref: "User", default: [] }],
    children: [FamilyChildSchema],
    custodyPatterns: [{ type: Schema.Types.Mixed, default: [] }],
}, {
    timestamps: true,
});

export const Family = mongoose.models.Family || mongoose.model<IFamily>("Family", FamilySchema);
