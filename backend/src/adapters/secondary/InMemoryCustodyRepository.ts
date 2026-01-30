import { CustodyRepository } from "../../core/ports/CustodyRepository";
import { CustodyEntry } from "../../core/domain/child/CustodyEntry";

export class InMemoryCustodyRepository implements CustodyRepository {
    private entries: CustodyEntry[] = [];

    async save(newEntries: CustodyEntry[]): Promise<void> {
        // Simple append, or maybe overwrite overlapping?
        // For simplicity: Append.
        // Actually, overlapping custody is common issue.
        // But for this MVP generator, we assume user clears old or just appends.
        // Better: Remove existing entries in the range?
        // Let's just append for now to be safe.
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
