import mongoose, { Schema, Document } from "mongoose";

export enum RegistrationStatus {
    FLOW_STARTED = "FLOW_STARTED",
    PARTIALLY_REGISTERED = "PARTIALLY_REGISTERED",
    COMPLETED = "COMPLETED",
}

export enum ParentRegistrationStatus {
    INVITATION_SENT = "INVITATION_SENT",
    EMAIL_OPENED = "EMAIL_OPENED",
    REGISTERED = "REGISTERED",
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
    familyName?: string;
    dadToken?: string;
    momToken?: string;
    dadTrackingToken?: string;
    momTrackingToken?: string;
    dadOpenedAt?: Date;
    momOpenedAt?: Date;
    dadRegisteredAt?: Date;
    momRegisteredAt?: Date;
    dadName?: string;
    dadEmail?: string;
    momName?: string;
    momEmail?: string;
    dadStatus: ParentRegistrationStatus;
    momStatus: ParentRegistrationStatus;
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
    familyName: { type: String },
    dadToken: { type: String },
    momToken: { type: String },
    dadTrackingToken: { type: String },
    momTrackingToken: { type: String },
    dadOpenedAt: { type: Date },
    momOpenedAt: { type: Date },
    dadRegisteredAt: { type: Date },
    momRegisteredAt: { type: Date },
    dadName: { type: String },
    dadEmail: { type: String },
    momName: { type: String },
    momEmail: { type: String },
    dadStatus: {
        type: String,
        enum: Object.values(ParentRegistrationStatus),
        default: ParentRegistrationStatus.INVITATION_SENT
    },
    momStatus: {
        type: String,
        enum: Object.values(ParentRegistrationStatus),
        default: ParentRegistrationStatus.INVITATION_SENT
    },
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
