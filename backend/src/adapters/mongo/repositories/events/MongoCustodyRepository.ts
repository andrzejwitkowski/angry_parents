import { CustodyRepository } from "../../../../domain/events/ports/CustodyRepository";
import { CustodyEntry } from "../../../../domain/events/model/child/CustodyEntry";
import { CustodyEntryModel } from "../../models/CustodyEntryModel";

export class MongoCustodyRepository implements CustodyRepository {
    async save(entries: CustodyEntry[]): Promise<void> {
        if (!entries.length) return;

        const operations = entries.map(entry => ({
            updateOne: {
                filter: { id: entry.id },
                update: { $set: entry },
                upsert: true
            }
        }));

        await CustodyEntryModel.bulkWrite(operations);
    }

    async findByDateRange(childId: string | undefined, startDate: string, endDate: string): Promise<CustodyEntry[]> {
        const query: any = {
            date: { $gte: startDate, $lte: endDate }
        };

        if (childId) {
            query.childId = childId;
        }

        const entries = await CustodyEntryModel.find(query).lean();

        return entries.map(e => ({
            id: e.id,
            childId: e.childId,
            date: e.date,
            startTime: e.startTime,
            endTime: e.endTime,
            assignedTo: e.assignedTo as "MOM" | "DAD",
            isRecurring: e.isRecurring,
            priority: e.priority,
            sourceRuleId: e.sourceRuleId
        }));
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        await CustodyEntryModel.deleteMany({ sourceRuleId: ruleId });
    }

    async updatePriorityByRuleId(ruleId: string, newPriority: number): Promise<void> {
        await CustodyEntryModel.updateMany(
            { sourceRuleId: ruleId },
            { $set: { priority: newPriority } }
        );
    }

    async deleteAll(): Promise<void> {
        await CustodyEntryModel.deleteMany({});
    }
}
