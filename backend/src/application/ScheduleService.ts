import { ScheduleRepository } from "../core/ports/ScheduleRepository";
import { CustodyRepository } from "../core/ports/CustodyRepository";
import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { ScheduleRule } from "../core/domain/child/ScheduleRule";
import { CustodyGenerator } from "./CustodyGenerator";

export class ScheduleService {
    constructor(
        private scheduleRepository: ScheduleRepository,
        private custodyRepository: CustodyRepository
    ) { }

    async createRule(config: CustodyPatternConfig): Promise<ScheduleRule> {
        const ruleId = `rule-${Date.now()}`;
        const rule: ScheduleRule = {
            id: ruleId,
            childId: config.childId,
            name: `${this.formatPatternName(config.type)} (${config.startDate})`,
            config: config,
            createdAt: new Date().toISOString()
        };

        // 1. Generate Entries
        const generator = new CustodyGenerator();
        const entries = generator.generate(config);

        // 2. Tag Entries with Rule ID
        const taggedEntries = entries.map(entry => ({
            ...entry,
            sourceRuleId: ruleId
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

    private formatPatternName(type: string): string {
        switch (type) {
            case 'ALTERNATING_WEEKEND': return 'Alt. Weekend';
            case 'TWO_TWO_THREE': return '2-2-3 Rotation';
            case 'CUSTOM_SEQUENCE': return 'Custom Loop';
            default: return type;
        }
    }
}
