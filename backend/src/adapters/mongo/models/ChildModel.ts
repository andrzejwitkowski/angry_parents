import mongoose, { Schema, Document } from "mongoose";
import type { Child } from "../../../domain/family/model/Child";

export interface ChildDocument extends Omit<Child, "id">, Document {
    id: string;
}

const childSchema = new Schema<ChildDocument>({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    color: { type: String, required: true },
    familyId: { type: String, required: true, index: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

export const ChildModel = mongoose.model<ChildDocument>("Child", childSchema);
