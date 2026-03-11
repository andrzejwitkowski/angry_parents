import { TimelineRepository } from "../../../../domain/events/ports/TimelineRepository";
import { EncryptedTimelineItem, EventProofRecord } from "../../../../domain/events/model/TimelineItem";
import { TimelineItemModel } from "../../models/TimelineItemModel";
import mongoose, { ClientSession } from "mongoose";

export class MongoTimelineRepository implements TimelineRepository {
    constructor() { }

    async save(item: EncryptedTimelineItem, session?: unknown): Promise<EncryptedTimelineItem> {
        const mongooseSession = session as ClientSession | undefined;
        await TimelineItemModel.findOneAndUpdate(
            { id: item.id },
            item,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session: mongooseSession }
        ).lean();

        return item;
    }

    async findByDate(date: string): Promise<EncryptedTimelineItem[]> {
        return TimelineItemModel.find({ date, isDeleted: false }).lean<EncryptedTimelineItem[]>();
    }

    async findByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]> {
        return TimelineItemModel.find({
            date: { $gte: from, $lte: to },
            isDeleted: false
        }).lean<EncryptedTimelineItem[]>();
    }

    async findById(id: string): Promise<EncryptedTimelineItem | null> {
        return TimelineItemModel.findOne({ id, isDeleted: false }).lean<EncryptedTimelineItem | null>();
    }

    async findByIdIncludingDeleted(id: string): Promise<EncryptedTimelineItem | null> {
        return TimelineItemModel.findOne({ id }).lean<EncryptedTimelineItem | null>();
    }

    async update(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem> {
        const mongooseSession = session as ClientSession | undefined;
        const existing = await TimelineItemModel.findOne({ id, isDeleted: false }, null, { session: mongooseSession }).lean();
        if (!existing) {
            throw new Error(`Item with id ${id} not found`);
        }

        const result = await TimelineItemModel.findOneAndUpdate(
            { id },
            { $set: updates },
            { returnDocument: "after", session: mongooseSession }
        ).lean();

        if (!result) {
            throw new Error(`Item with id ${id} not found on update`);
        }

        return result;
    }

    async updateIncludingDeleted(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem> {
        const mongooseSession = session as ClientSession | undefined;
        const existing = await TimelineItemModel.findOne({ id }, null, { session: mongooseSession }).lean();
        if (!existing) {
            throw new Error(`Item with id ${id} not found`);
        }

        const result = await TimelineItemModel.findOneAndUpdate(
            { id },
            { $set: updates },
            { returnDocument: "after", session: mongooseSession }
        ).lean();

        if (!result) {
            throw new Error(`Item with id ${id} not found on update`);
        }

        return result;
    }

    async delete(id: string, session?: unknown): Promise<void> {
        const mongooseSession = session as ClientSession | undefined;
        const result = await TimelineItemModel.updateOne(
            { id },
            { $set: { isDeleted: true } },
            { session: mongooseSession }
        );

        if (result.matchedCount === 0) {
            throw new Error(`Item with id ${id} not found`);
        }
    }

    async claimPendingProofRecord(id: string, proof: EventProofRecord, session?: unknown): Promise<boolean> {
        const mongooseSession = session as ClientSession | undefined;
        const claimed = await TimelineItemModel.findOneAndUpdate(
            {
                id,
                "versionHistory.version": proof.version,
                versionHistory: {
                    $not: {
                        $elemMatch: {
                            version: proof.version,
                            "proofHistory.hash": proof.hash,
                        },
                    },
                },
            },
            {
                $push: {
                    "versionHistory.$[ver].proofHistory": proof,
                },
            },
            {
                arrayFilters: [{ "ver.version": proof.version }],
                returnDocument: "after",
                session: mongooseSession,
            }
        ).lean();

        if (claimed) {
            return true;
        }

        const versionEntry = await this.findVersionEntry(id, proof.version, mongooseSession);
        const proofExists = versionEntry.proofHistory.some((existingProof) => existingProof.hash === proof.hash);
        if (proofExists) {
            return false;
        }

        throw new Error(`Item with id ${id} and version ${proof.version} not found`);
    }

    async appendProofRecord(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem> {
        const mongooseSession = session as ClientSession | undefined;
        const versionEntry = await this.findVersionEntry(id, proof.version, mongooseSession);
        const proofExists = versionEntry.proofHistory.some((p) => p.hash === proof.hash);

        const result = proofExists
            ? await this.mergeExistingProofEntry(id, proof, mongooseSession)
            : await this.pushNewProofEntry(id, proof, mongooseSession);

        if (!result) {
            throw new Error(`Item with id ${id} and version ${proof.version} not found`);
        }

        return result;
    }

    private async findVersionEntry(id: string, version: number, session: ClientSession | undefined) {
        const existing = await TimelineItemModel.findOne(
            { id, "versionHistory.version": version },
            null,
            { session }
        ).lean<EncryptedTimelineItem | null>();

        if (!existing) {
            throw new Error(`Item with id ${id} and version ${version} not found`);
        }

        const versionEntry = existing.versionHistory.find((entry) => entry.version === version);
        if (!versionEntry) {
            throw new Error(`Item with id ${id} and version ${version} not found`);
        }

        return versionEntry;
    }

    private async mergeExistingProofEntry(id: string, proof: EventProofRecord, session: ClientSession | undefined) {
        const setOperations: Record<string, string> = {
            "versionHistory.$[ver].proofHistory.$[prf].hash": proof.hash,
        };

        if (proof.txHash !== undefined) {
            setOperations["versionHistory.$[ver].proofHistory.$[prf].txHash"] = proof.txHash;
        }

        if (proof.blockNumber !== undefined) {
            setOperations["versionHistory.$[ver].proofHistory.$[prf].blockNumber"] = proof.blockNumber;
        }

        if (proof.anchoredAt !== undefined) {
            setOperations["versionHistory.$[ver].proofHistory.$[prf].anchoredAt"] = proof.anchoredAt;
        }

        return TimelineItemModel.findOneAndUpdate(
            { id, "versionHistory.version": proof.version },
            {
                $set: setOperations,
            },
            {
                arrayFilters: [
                    { "ver.version": proof.version },
                    { "prf.hash": proof.hash },
                ],
                returnDocument: "after",
                session,
            }
        ).lean();
    }

    private async pushNewProofEntry(id: string, proof: EventProofRecord, session: ClientSession | undefined) {
        return TimelineItemModel.findOneAndUpdate(
            { id, "versionHistory.version": proof.version },
            {
                $push: {
                    "versionHistory.$[ver].proofHistory": proof,
                },
            },
            {
                arrayFilters: [{ "ver.version": proof.version }],
                returnDocument: "after",
                session,
            }
        ).lean();
    }

    async countByChildId(childId: string): Promise<number> {
        return TimelineItemModel.countDocuments({ childIds: childId, isDeleted: false });
    }

    async withTransaction<T>(operation: (session?: unknown) => Promise<T>): Promise<T> {
        try {
            const session = await mongoose.startSession();
            try {
                let result!: T;
                await session.withTransaction(async () => {
                    result = await operation(session);
                });
                return result;
            } finally {
                await session.endSession();
            }
        } catch (error) {
            if (error instanceof Error && (
                error.message.includes("Transaction numbers are only allowed on a replica set member") ||
                error.message.includes("sessions are not supported")
            )) {
                console.warn("[MongoDB] Transactions not supported on this instance. Running operation without transaction.");
                return operation();
            }
            throw error;
        }
    }
}
