import { CustodyRepository } from "../../../../domain/events/ports/CustodyRepository";
import { CustodyEntry } from "../../../../domain/events/model/child/CustodyEntry";

export class InMemoryCustodyRepository implements CustodyRepository {
    private entries: CustodyEntry[] = [];

    async save(newEntries: CustodyEntry[]): Promise<void> {
        this.entries.push(...newEntries);
    }

    async findByDateRange(childId: string | undefined, startDate: string, endDate: string): Promise<CustodyEntry[]> {
        return this.entries.filter(e => {
            const matchesChild = childId ? e.childId === childId : true;
            const inRange = e.date >= startDate && e.date <= endDate;
            return matchesChild && inRange;
        });
    }

    async deleteAll(): Promise<void> {
        this.entries = [];
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        this.entries = this.entries.filter(e => e.sourceRuleId !== ruleId);
    }

    async updatePriorityByRuleId(ruleId: string, newPriority: number): Promise<void> {
        this.entries.forEach(e => {
            if (e.sourceRuleId === ruleId) {
                e.priority = newPriority;
            }
        });
    }
}
