export type PatternType = 'WEEKLY' | 'WEEKEND' | 'ALTERNATING_WEEKEND' | 'TWO_TWO_THREE' | 'CUSTOM_SEQUENCE' | 'HOLIDAY';

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
    sequence?: number[];
    holidays?: string[];
}
