import { PatternType } from "./CustodyEntry";

export interface CustodyPatternConfig {
    childId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    type: PatternType;
    startingParent: 'MOM' | 'DAD';
    handoverTime?: string; // e.g. "17:00". Crucial for split days.
    handoverEndTime?: string; // e.g. "19:00". When the full cycle ends.
    sequence?: number[];   // For 2-2-3 (e.g. [2, 2, 3])
    holidays?: string[];   // List of dates for Holiday Override
    isOneTime?: boolean;   // If true, do not propagate to next month
    // CUSTOM_BLOCK details
    customBlockRepeatInterval?: number; // e.g., 1, 2
    customBlockRepeatUnit?: 'DAYS' | 'WEEKS';
    customBlockEndDayOffset?: number; // How many days after startDate this block ends.
    anchorDate?: string; // Stable anchor for recurring math across propagated months
    // GAP_FILL-only: IDs of the rules immediately before/after this gap
    anchorBeforeRuleId?: string;
    anchorAfterRuleId?: string;
}
