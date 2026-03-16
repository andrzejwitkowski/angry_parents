import { ClientSession } from "mongoose";
import { TimelineMutationRequestModel } from "../../models/TimelineMutationRequestModel";
import type { TimelineMutationRequestRecord, TimelineMutationRequestRepository } from "../../../../domain/events/ports/TimelineMutationRequestRepository";

export class MongoTimelineMutationRequestRepository implements TimelineMutationRequestRepository {
    async ensureIndexes(): Promise<void> {
        await TimelineMutationRequestModel.syncIndexes();
    }

    async save(record: TimelineMutationRequestRecord, session?: unknown): Promise<void> {
        const mongooseSession = session as ClientSession | undefined;
        await TimelineMutationRequestModel.create([record], { session: mongooseSession });
    }

    async update(record: TimelineMutationRequestRecord, session?: unknown): Promise<void> {
        const mongooseSession = session as ClientSession | undefined;
        await TimelineMutationRequestModel.updateOne(
            { idempotencyKey: record.idempotencyKey },
            { $set: record },
            { upsert: true, session: mongooseSession }
        );
    }

    async findByIdempotencyKey(idempotencyKey: string): Promise<TimelineMutationRequestRecord | null> {
        const doc = await TimelineMutationRequestModel.findOne({ idempotencyKey }).lean();
        return (doc as unknown as TimelineMutationRequestRecord) ?? null;
    }

    async deleteAll(): Promise<void> {
        await TimelineMutationRequestModel.deleteMany({});
    }
}
