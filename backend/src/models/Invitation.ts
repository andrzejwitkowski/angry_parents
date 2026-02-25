import mongoose, { Schema, Document } from "mongoose";

export type Gender = "mom" | "dad";

export interface IInvitation extends Document {
    _id: mongoose.Types.ObjectId;
    token: string;
    email: string;
    familyId: string;
    invitedBy: string;
    createdByGender: Gender;
    expiresAt: Date;
    status: "pending" | "accepted" | "expired";
    createdAt: Date;
    updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>({
    token: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    familyId: { type: String, ref: "Family", required: true },
    invitedBy: { type: String, required: true },
    createdByGender: { type: String, enum: ["mom", "dad"], required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
}, {
    timestamps: true,
});

export const Invitation = mongoose.models.Invitation || mongoose.model<IInvitation>("Invitation", InvitationSchema);
