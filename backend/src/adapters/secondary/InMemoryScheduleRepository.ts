import { ScheduleRepository } from "../../core/ports/ScheduleRepository";
import { ScheduleRule } from "../../core/domain/child/ScheduleRule";

export class InMemoryScheduleRepository implements ScheduleRepository {
    private rules: ScheduleRule[] = [];

    async save(rule: ScheduleRule): Promise<void> {
        const index = this.rules.findIndex(r => r.id === rule.id);
        if (index >= 0) {
            this.rules[index] = rule;
        } else {
            this.rules.push(rule);
        }
    }

    async findById(id: string): Promise<ScheduleRule | null> {
        return this.rules.find(r => r.id === id) || null;
    }

    async findAllByChildId(childId: string): Promise<ScheduleRule[]> {
        return this.rules.filter(r => r.childId === childId);
    }

    async delete(id: string): Promise<void> {
        this.rules = this.rules.filter(r => r.id !== id);
    }
}
