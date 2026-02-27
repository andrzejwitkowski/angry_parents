import { ScheduleRepository } from "../../core/ports/ScheduleRepository";
import { ScheduleRule } from "../../core/domain/child/ScheduleRule";
import { ScheduleRuleModel } from "../../models/ScheduleRule";

export class MongoScheduleRepository implements ScheduleRepository {
    async save(rule: ScheduleRule): Promise<void> {
        await ScheduleRuleModel.findOneAndUpdate(
            { id: rule.id },
            rule,
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
    }

    async findById(id: string): Promise<ScheduleRule | null> {
        const doc = await ScheduleRuleModel.findOne({ id }).lean();
        if (!doc) return null;
        return {
            id: doc.id,
            childId: doc.childId,
            name: doc.name,
            config: doc.config,
            priority: doc.priority,
            isOneTime: doc.isOneTime,
            createdAt: doc.createdAt
        };
    }

    async findAllByChildId(childId: string): Promise<ScheduleRule[]> {
        const rules = await ScheduleRuleModel.find({ childId }).lean();
        return rules.map(doc => ({
            id: doc.id,
            childId: doc.childId,
            name: doc.name,
            config: doc.config,
            priority: doc.priority,
            isOneTime: doc.isOneTime,
            createdAt: doc.createdAt
        }));
    }

    async delete(id: string): Promise<void> {
        await ScheduleRuleModel.deleteOne({ id });
    }
}
