import { ScheduleRepository } from "../core/ports/ScheduleRepository";
import { ScheduleRule } from "../core/domain/child/ScheduleRule";
import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { addMonths, startOfMonth, endOfMonth, parseISO, format, differenceInCalendarWeeks } from "date-fns";

export interface PropagationResult {
    canProceed: boolean;
    rulesToCreate: CustodyPatternConfig[];
    skippedRules: Array<{ ruleName: string; reason: 'ONE_TIME' | 'INVALID_DATE' }>;
}

export class PropagationService {
    constructor(private scheduleRepository: ScheduleRepository) { }

    async simulatePropagation(childId: string, currentMonthDate: string): Promise<PropagationResult> {
        const currentDate = parseISO(currentMonthDate);
        const nextMonthDate = addMonths(currentDate, 1);
        const nextMonthStart = format(startOfMonth(nextMonthDate), 'yyyy-MM-dd');
        const nextMonthEnd = format(endOfMonth(nextMonthDate), 'yyyy-MM-dd');

        // Fetch all active rules for this child
        // Ideally we filter by date range, but for now we fetch all and check overlap
        const allRules = await this.scheduleRepository.findAllByChildId(childId);

        // Filter rules relevant to CURRENT month
        // A rule is relevant if it's active during the current month
        const currentMonthStartStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const currentMonthEndStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');

        const activeRules = allRules.filter(rule => {
            return rule.config.startDate <= currentMonthEndStr && rule.config.endDate >= currentMonthStartStr;
        });

        const rulesToCreate: CustodyPatternConfig[] = [];
        const skippedRules: Array<{ ruleName: string; reason: 'ONE_TIME' | 'INVALID_DATE' }> = [];

        for (const rule of activeRules) {
            // 1. Check Exclusion
            if (rule.isOneTime) {
                skippedRules.push({ ruleName: rule.name, reason: 'ONE_TIME' });
                continue;
            }

            // 2. Clone and Adjust
            try {
                const nextConfig = this.calculateNextConfig(rule, nextMonthStart, nextMonthEnd);
                rulesToCreate.push(nextConfig);
            } catch {
                // If date calculations fail (unlikely for full month propagation but possible)
                skippedRules.push({ ruleName: rule.name, reason: 'INVALID_DATE' });
            }
        }

        return {
            canProceed: true, // simplified
            rulesToCreate,
            skippedRules
        };
    }

    private calculateNextConfig(rule: ScheduleRule, nextStart: string, nextEnd: string): CustodyPatternConfig {
        const config = { ...rule.config };
        config.startDate = nextStart;
        config.endDate = nextEnd;

        // Continuity Logic based on pattern type
        switch (config.type) {
            case 'ALTERNATING_WEEKEND':
            case 'CUSTOM_SEQUENCE':
                // Stable math in strategies now handles parity automatically via anchorDate
                break;

            case 'HOLIDAY':
                // Holidays are date-specific, they should NOT propagate automatically
                // unless we implement recurring holiday logic (e.g., "every Dec 25")
                // For now, skip holidays in propagation - they need explicit re-creation
                break;

            case 'GAP_FILL':
                this.calculateGapFillParity(config, rule.config, nextStart, nextEnd);
                break;

            case 'WEEKLY':
            case 'WEEKEND':
                // These patterns are simple and don't require parity swapping
                // They repeat identically each week
                break;

            default:
                // Unknown pattern type - just copy dates
                break;
        }

        // Clear Holidays (specific dates don't propagate blindly)
        // Recurring holiday logic would require a different approach
        config.holidays = [];

        return config;
    }



    /**
     * Calculate dates for GAP_FILL pattern.
     * Uses anchorBefore/AfterRuleId to find surrounding rules in the next month
     * and fills the gap between them.
     */
    private calculateGapFillParity(
        config: CustodyPatternConfig,
        originalConfig: CustodyPatternConfig,
        nextMonthStart: string,
        nextMonthEnd: string
    ): void {
        // Default to full month if anchors fail.
        // As per design decision: effectively creates a "background" fill for the whole month
        // which is overridden by any higher-priority rules.
        config.startDate = nextMonthStart;
        config.endDate = nextMonthEnd;
    }
}
