import { ScheduleRepository } from "../core/ports/ScheduleRepository";
import { CustodyRepository } from "../core/ports/CustodyRepository";
import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { ScheduleRule } from "../core/domain/child/ScheduleRule";
import { CustodyEntry } from "../core/domain/child/CustodyEntry";
import { CustodyGenerator } from "./CustodyGenerator";

export class ScheduleService {
    constructor(
        private scheduleRepository: ScheduleRepository,
        private custodyRepository: CustodyRepository
    ) { }

    async createRule(config: CustodyPatternConfig): Promise<ScheduleRule> {
        // 0. Calculate Priority
        const existingRules = await this.scheduleRepository.findAllByChildId(config.childId);
        const maxPriority = existingRules.length > 0
            ? Math.max(...existingRules.map(r => r.priority))
            : 0;
        const newPriority = maxPriority + 1;

        const ruleId = `rule-${Date.now()}`;
        const rule: ScheduleRule = {
            id: ruleId,
            childId: config.childId,
            name: `${this.formatPatternName(config.type)} (${config.startDate})`,
            config: config,
            priority: newPriority,
            isOneTime: !!config.isOneTime,
            createdAt: new Date().toISOString()
        };

        // 1. Generate Entries
        const generator = new CustodyGenerator();
        const entries = generator.generate(config);

        // 2. Tag Entries with Rule ID and Priority
        const taggedEntries = entries.map(entry => ({
            ...entry,
            sourceRuleId: ruleId,
            priority: newPriority // Explicitly set priority from rule
        }));

        // 3. Save Rule
        await this.scheduleRepository.save(rule);

        // 4. Save Entries
        await this.custodyRepository.save(taggedEntries);

        return rule;
    }

    async deleteRule(ruleId: string): Promise<void> {
        // 1. Delete associated custody entries
        await this.custodyRepository.deleteByRuleId(ruleId);

        // 2. Delete the rule itself
        await this.scheduleRepository.delete(ruleId);
    }

    async getRulesByChild(childId: string): Promise<ScheduleRule[]> {
        return this.scheduleRepository.findAllByChildId(childId);
    }

    async reorderRule(ruleId: string, direction: 'UP' | 'DOWN'): Promise<void> {
        const rule = await this.scheduleRepository.findById(ruleId);
        if (!rule) throw new Error("Rule not found");

        const allRules = await this.scheduleRepository.findAllByChildId(rule.childId);
        // Sort by priority ASC (Low to High) or DESC?
        // Let's settle on: Higher Number = Higher Priority (Wins).
        // So "UP" means increasing priority value.
        // "DOWN" means decreasing priority value.
        const sortedRules = allRules.sort((a, b) => a.priority - b.priority);

        const currentIndex = sortedRules.findIndex(r => r.id === ruleId);
        if (currentIndex === -1) return;

        let swapWithIndex = -1;
        if (direction === 'UP') {
            // Want to move "UP" in the visual list (which is usually High Priority on TOP).
            // Wait, visual list usually puts "Highest Priority" on top.
            // If I want to move "UP" visually, I want to INCREASE my priority relative to the one above me.
            // If sorted by Priority ASC (0, 1, 2...), the "Highest" is at the end.
            // Let's assume Visual List is sorted Priority DESC (Highest first).
            // "Up" arrow means "Make me higher priority than the guy above me".
            // So I need to swap with the guy who has Higher Priority (next in ASC list).
            swapWithIndex = currentIndex + 1;
        } else {
            // "Down" arrow means "Make me lower priority".
            swapWithIndex = currentIndex - 1;
        }

        if (swapWithIndex < 0 || swapWithIndex >= sortedRules.length) return; // Can't move

        const otherRule = sortedRules[swapWithIndex];

        // Swap Priorities
        const temp = rule.priority;
        rule.priority = otherRule.priority;
        otherRule.priority = temp;

        // Save Rules
        await this.scheduleRepository.save(rule);
        await this.scheduleRepository.save(otherRule);

        // Update Entries Priorities (Expensive but necessary)
        // We need to fetch entries for both rules and update their priority field.
        await this.updateEntriesPriority(rule.id, rule.priority);
        await this.updateEntriesPriority(otherRule.id, otherRule.priority);
    }

    private async updateEntriesPriority(ruleId: string, newPriority: number) {
        // This requires a new Repo method or inefficient fetch-filter-save
        // Repository pattern ideally has updateByRuleId.
        // For MVP InMemory, let's fetch all, filter in memory, save back.
        // But CustodyRepository.findByRuleId doesn't exist?
        // We have findByDateRange.
        // Actually, for In-Memory, we can iterate all.
        // But we don't have access to "All".
        // Let's assume we can fetch by child roughly?
        // Or adding `findByRuleId` to repo is cleaner.
        // Let's stick to adding `updatePriorityByRuleId` to Repo if possible, 
        // OR just rely on "All entries for child" if we ignore date range... 
        // Wait, `findByDateRange` requires dates.
        // I'll add `updatePriorityByRuleId` to CustodyRepository interface.
        await this.custodyRepository.updatePriorityByRuleId(ruleId, newPriority);
    }

    async getResolvedCalendar(childId: string | undefined, startDate: string, endDate: string): Promise<CustodyEntry[]> {
        const rawEntries = await this.custodyRepository.findByDateRange(childId, startDate, endDate);
        return this.resolveConflicts(rawEntries);
    }

    private resolveConflicts(entries: CustodyEntry[]): CustodyEntry[] {
        // Group by Date + Time (or just Date if we assume daily granularity for now, but Entry has Time)
        // Let's assume conflict is "Overlapping Time". For MVP, simple Daily/Block equality?
        // Actually, the prompt implies "Time Slot".
        // Simplest Robust Logic:
        // 1. Sort all entries by Priority DESC.
        // 2. Filter conflicts?
        //    If we allow Overlaps (e.g. 9-12 Mom, 12-5 Dad), we need collision detection.
        //    BUT our generator produces Daily blocks mostly.
        //    Let's stick to the "Tower" logic: "The calendar state for a specific time slot..."
        //    We can group by ID? No.
        //    We can assume entries are chunks.
        //    If we have multiple entries for the SAME day...
        //    Let's group by `date`.
        //    For each date, look at entries.
        //    If entries overlap in time, highest priority wins.
        //    For MVP "Day Color" test, we usually have full day entries or compatible ones.
        //    Conflict = Same Date + Overlapping Time.
        //    Strategy:
        //    Iterate through sorted entries (High to Low).
        //    Keep an entry if it doesn't overlap with already accepted (Higher Priority) entries.

        const sorted = [...entries].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        const accepted: CustodyEntry[] = [];

        for (const entry of sorted) {
            const isBlocked = accepted.some(acc =>
                acc.date === entry.date && // Same Day
                this.isTimeOverlap(acc, entry)
            );
            if (!isBlocked) {
                accepted.push(entry);
            }
        }
        return accepted;
    }

    async checkConflicts(config: CustodyPatternConfig, excludeRuleId?: string): Promise<ScheduleRule[]> {
        // 1. Generate temp entries for the new config
        const generator = new CustodyGenerator();
        const newEntries = generator.generate(config);

        if (newEntries.length === 0) return [];

        // 2. Determine range
        const startDate = newEntries.reduce((min, e) => e.date < min ? e.date : min, newEntries[0].date);
        const endDate = newEntries.reduce((max, e) => e.date > max ? e.date : max, newEntries[0].date);

        // 3. Fetch all existing entries in this range
        const existingEntries = await this.custodyRepository.findByDateRange(config.childId, startDate, endDate);

        // 4. Find conflicting Rule IDs
        const conflictingRuleIds = new Set<string>();

        for (const newEntry of newEntries) {
            for (const existing of existingEntries) {
                // Ignore self (if editing)
                if (excludeRuleId && existing.sourceRuleId === excludeRuleId) continue;

                // Ignore entries without source rule (shouldn't happen for rules, but maybe manual entries?)
                if (!existing.sourceRuleId) continue;

                if (newEntry.date === existing.date && this.isTimeOverlap(newEntry, existing)) {
                    conflictingRuleIds.add(existing.sourceRuleId);
                }
            }
        }

        if (conflictingRuleIds.size === 0) return [];

        // 5. Fetch Rule objects
        // Ineffecient? Fetch all and filter.
        const allRules = await this.getRulesByChild(config.childId);
        return allRules.filter(r => conflictingRuleIds.has(r.id));
    }

    private isTimeOverlap(a: CustodyEntry, b: CustodyEntry): boolean {
        // Simple string comparison for '00:00' format works naturally
        return a.startTime < b.endTime && a.endTime > b.startTime;
    }

    private formatPatternName(type: string): string {
        switch (type) {
            case 'ALTERNATING_WEEKEND': return 'Alt. Weekend';
            case 'TWO_TWO_THREE': return '2-2-3 Rotation';
            case 'CUSTOM_SEQUENCE': return 'Custom Loop';
            default: return type;
        }
    }
}
