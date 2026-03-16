import { ClientSession } from "mongoose";
import { TaskOutboxModel } from "../../models/TaskOutboxModel";
import type { TaskOutboxAppendInput, TaskOutboxRecord, TaskOutboxRepository } from "../../../../domain/shared/ports/TaskOutboxRepository";
import type { DateProvider } from "../../../../domain/shared/ports/DateProvider";
import { RealDateProvider } from "../../../../shared/providers/RealDateProvider";

export class MongoTaskOutboxRepository implements TaskOutboxRepository {
    constructor(private readonly dateProvider: DateProvider = new RealDateProvider()) {}

    async ensureIndexes(): Promise<void> {
        await TaskOutboxModel.syncIndexes();
    }

    async append(entry: TaskOutboxAppendInput, session?: unknown): Promise<void> {
        const mongooseSession = session as ClientSession | undefined;
        await TaskOutboxModel.updateOne(
            {
                taskType: entry.taskType,
                payloadHash: entry.payloadHash,
            },
            {
                $setOnInsert: {
                    ...entry,
                    status: "PENDING",
                    availableAt: this.dateProvider.getNow(),
                    lockedUntil: null,
                },
            },
            {
                upsert: true,
                session: mongooseSession,
            }
        );
    }

    async claimNext(): Promise<TaskOutboxRecord | null> {
        const now = this.dateProvider.getNow();
        const claimed = await TaskOutboxModel.findOneAndUpdate(
            {
                $or: [
                    {
                        status: "PENDING",
                        availableAt: { $lte: now },
                    },
                    {
                        status: "CLAIMED",
                        lockedUntil: { $lt: now },
                    }
                ]
            },
            {
                $set: {
                    status: "CLAIMED",
                    lockedUntil: new Date(now.getTime() + 5 * 60 * 1000),
                }
            },
            {
                returnDocument: "after",
                sort: { availableAt: 1 },
            }
        ).lean();

        if (!claimed) {
            return null;
        }

        return {
            ...(claimed as any),
            id: (claimed as any)._id?.toString?.() ?? (claimed as any).id,
        } as TaskOutboxRecord;
    }

    async markDispatched(id: string): Promise<void> {
        await TaskOutboxModel.updateOne(
            { _id: id },
            { $set: { status: "DISPATCHED", lockedUntil: null } }
        );
    }

    async markPending(id: string): Promise<void> {
        await TaskOutboxModel.updateOne(
            { _id: id },
            { $set: { status: "PENDING", lockedUntil: null } }
        );
    }

    async deleteAll(): Promise<void> {
        await TaskOutboxModel.deleteMany({});
    }
}
