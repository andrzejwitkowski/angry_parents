export type PatternType = 'WEEKLY' | 'WEEKEND' | 'ALTERNATING_WEEKEND' | 'CUSTOM_BLOCK' | 'CUSTOM_SEQUENCE' | 'HOLIDAY';

export interface CustodyEntry {
    id: string;
    childId: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM
    endTime: string;    // HH:MM
    assignedTo: 'MOM' | 'DAD';
    isRecurring: boolean;
    priority: number;
}

export interface CustodyPatternConfig {
    childId: string;
    startDate: string;
    endDate: string;
    type: PatternType;
    startingParent: 'MOM' | 'DAD';
    handoverTime?: string;
    handoverEndTime?: string;
    sequence?: number[];
    holidays?: string[];
    isOneTime?: boolean;
    // CUSTOM_BLOCK details
    customBlockRepeatInterval?: number;
    customBlockRepeatUnit?: 'DAYS' | 'WEEKS';
    customBlockEndDayOffset?: number;
    customBlockStartDay?: number; // 0-6 corresponding to Sunday-Saturday

    anchorDate?: string;
}

export interface ScheduleRule {
    id: string;
    childId: string;
    name: string;
    config: CustodyPatternConfig;
    priority: number;
    isOneTime: boolean;
    createdAt: string;
}
