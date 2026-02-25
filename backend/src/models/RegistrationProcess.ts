import mongoose, { Schema, Document } from "mongoose";

export enum RegistrationStatus {
    FLOW_STARTED = "FLOW_STARTED",
    PARENT_A_VALIDATED = "PARENT_A_VALIDATED",
    INVITATION_SENT = "INVITATION_SENT",
    PARENT_B_REGISTERED = "PARENT_B_REGISTERED",
    COMPLETED = "COMPLETED",
}

export interface IRegistrationTimelineEvent {
    type: string;
    message: string;
    timestamp: Date;
    data?: Record<string, any>;
}

export interface IRegistrationProcess extends Document {
    _id: mongoose.Types.ObjectId;
    familyId?: string;
    parentAName?: string;
    parentAEmail?: string;
    parentBName?: string;
    parentBEmail?: string;
    status: RegistrationStatus;
    timeline: IRegistrationTimelineEvent[];
    adminNotes: string;
    createdAt: Date;
    updatedAt: Date;
}

const RegistrationTimelineEventSchema = new Schema({
    type: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    data: { type: Schema.Types.Mixed },
}, { _id: false });

const RegistrationProcessSchema = new Schema<IRegistrationProcess>({
    familyId: { type: String, ref: "Family" },
    parentAName: { type: String },
    parentAEmail: { type: String },
    parentBName: { type: String },
    parentBEmail: { type: String },
    status: {
        type: String,
        enum: Object.values(RegistrationStatus),
        default: RegistrationStatus.FLOW_STARTED
    },
    timeline: [RegistrationTimelineEventSchema],
    adminNotes: { type: String, default: "" },
}, {
    timestamps: true,
});

export const RegistrationProcess = mongoose.models.RegistrationProcess || mongoose.model<IRegistrationProcess>("RegistrationProcess", RegistrationProcessSchema);
