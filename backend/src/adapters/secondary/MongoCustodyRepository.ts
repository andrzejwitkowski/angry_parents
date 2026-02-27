import { CustodyRepository } from "../../core/ports/CustodyRepository";
import { CustodyEntry } from "../../core/domain/child/CustodyEntry";
import { CustodyEntryModel } from "../../models/CustodyEntry";

export class MongoCustodyRepository implements CustodyRepository {
    async save(entries: CustodyEntry[]): Promise<void> {
        if (!entries.length) return;

        // Using bulkWrite to upsert entries by ID
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
            assignedTo: e.assignedTo as 'MOM' | 'DAD',
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
