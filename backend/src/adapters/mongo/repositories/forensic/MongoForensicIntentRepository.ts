import { ClientSession } from "mongoose";
import { ForensicIntentModel } from "../../models/ForensicIntentModel";
import type { ForensicIntentRecord, ForensicIntentRepository } from "../../../../domain/forensic/ports/ForensicIntentRepository";

export class MongoForensicIntentRepository implements ForensicIntentRepository {
    async save(intent: ForensicIntentRecord, session?: unknown): Promise<void> {
        const mongooseSession = session as ClientSession | undefined;
        await ForensicIntentModel.findOneAndUpdate(
            { id: intent.id },
            intent,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session: mongooseSession }
        ).lean();
    }

    async findById(id: string): Promise<ForensicIntentRecord | null> {
        const doc = await ForensicIntentModel.findOne({ id }).lean();
        return (doc as unknown as ForensicIntentRecord) ?? null;
    }

    async markProcessing(id: string, timeoutMinutes = 5): Promise<boolean> {
        const now = new Date();
        const timeoutMs = timeoutMinutes * 60 * 1000;

        const result = await ForensicIntentModel.updateOne(
            {
                id,
                $or: [
                    { status: "PENDING" },
                    {
                        status: "PROCESSING",
                        processingStartedAt: { $lt: new Date(now.getTime() - timeoutMs) }
                    }
                ]
            },
            {
                $set: {
                    status: "PROCESSING",
                    processingStartedAt: now
                },
                $inc: { retryCount: 1 }
            }
        );
        return result.modifiedCount === 1;
    }

    async markCompleted(id: string): Promise<void> {
        await ForensicIntentModel.updateOne(
            { id },
            { $set: { status: "COMPLETED", lastError: null } }
        );
    }

    async markRetry(id: string, errorMessage: string): Promise<void> {
        await ForensicIntentModel.updateOne(
            { id, status: { $ne: "COMPLETED" } },
            { $set: { status: "PENDING", lastError: errorMessage } }
        );
    }
}
