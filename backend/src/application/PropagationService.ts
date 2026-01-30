import { ScheduleRepository } from "../core/ports/ScheduleRepository";
import { ScheduleRule } from "../core/domain/child/ScheduleRule";
import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { addMonths, startOfMonth, endOfMonth, parseISO, format, differenceInCalendarWeeks, addDays } from "date-fns";

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
            } catch (e) {
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
                this.calculateAlternatingWeekendParity(config, rule.config);
                break;

            case 'TWO_TWO_THREE':
                this.calculateTwoTwoThreeParity(config, rule.config, nextStart);
                break;

            case 'CUSTOM_SEQUENCE':
                // Custom sequences need day-based parity calculation
                this.calculateCustomSequenceParity(config, rule.config, nextStart);
                break;

            case 'HOLIDAY':
                // Holidays are date-specific, they should NOT propagate automatically
                // unless we implement recurring holiday logic (e.g., "every Dec 25")
                // For now, skip holidays in propagation - they need explicit re-creation
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
     * Calculate parent parity for ALTERNATING_WEEKEND pattern.
     * If an odd number of weeks have passed, swap the starting parent.
     */
    private calculateAlternatingWeekendParity(config: CustodyPatternConfig, originalConfig: CustodyPatternConfig): void {
        const originalDate = parseISO(originalConfig.startDate);
        const newDate = parseISO(config.startDate);
        const weeksDiff = differenceInCalendarWeeks(newDate, originalDate);

        if (weeksDiff % 2 !== 0) {
            // Odd number of weeks => Swap Parent
            config.startingParent = config.startingParent === 'DAD' ? 'MOM' : 'DAD';
        }
    }

    /**
     * Calculate parent parity for TWO_TWO_THREE pattern.
     * The 2-2-3 pattern has a 7-day cycle (2+2+3=7).
     * We count total days elapsed and determine position in cycle.
     */
    private calculateTwoTwoThreeParity(config: CustodyPatternConfig, originalConfig: CustodyPatternConfig, nextStart: string): void {
        const sequence = originalConfig.sequence || [2, 2, 3];
        const cycleLength = sequence.reduce((sum, n) => sum + n, 0); // 7 for 2-2-3

        const originalDate = parseISO(originalConfig.startDate);
        const newDate = parseISO(nextStart);
        const daysDiff = Math.floor((newDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate position in the cycle
        const positionInCycle = ((daysDiff % cycleLength) + cycleLength) % cycleLength;

        // Determine which segment of the sequence we're in
        let daysAccumulated = 0;
        let segmentIndex = 0;
        for (let i = 0; i < sequence.length; i++) {
            daysAccumulated += sequence[i];
            if (positionInCycle < daysAccumulated) {
                segmentIndex = i;
                break;
            }
        }

        // If segmentIndex is odd, swap parent
        if (segmentIndex % 2 !== 0) {
            config.startingParent = config.startingParent === 'DAD' ? 'MOM' : 'DAD';
        }
    }

    /**
     * Calculate parent parity for CUSTOM_SEQUENCE pattern.
     * Similar logic to 2-2-3 but uses the custom sequence provided.
     */
    private calculateCustomSequenceParity(config: CustodyPatternConfig, originalConfig: CustodyPatternConfig, nextStart: string): void {
        const sequence = originalConfig.sequence;
        if (!sequence || sequence.length === 0) {
            // No sequence defined, cannot calculate parity
            return;
        }

        const cycleLength = sequence.reduce((sum, n) => sum + n, 0);
        if (cycleLength === 0) return;

        const originalDate = parseISO(originalConfig.startDate);
        const newDate = parseISO(nextStart);
        const daysDiff = Math.floor((newDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate position in the cycle
        const positionInCycle = ((daysDiff % cycleLength) + cycleLength) % cycleLength;

        // Determine which segment of the sequence we're in
        let daysAccumulated = 0;
        let segmentIndex = 0;
        for (let i = 0; i < sequence.length; i++) {
            daysAccumulated += sequence[i];
            if (positionInCycle < daysAccumulated) {
                segmentIndex = i;
                break;
            }
        }

        // If segmentIndex is odd, swap parent
        if (segmentIndex % 2 !== 0) {
            config.startingParent = config.startingParent === 'DAD' ? 'MOM' : 'DAD';
        }
    }
}
