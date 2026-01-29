export type PatternType = 'WEEKLY' | 'WEEKEND' | 'ALTERNATING_WEEKEND' | 'TWO_TWO_THREE' | 'CUSTOM_SEQUENCE' | 'HOLIDAY';

export interface CustodyEntry {
    id: string;
    childId: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM (Default "00:00")
    endTime: string;    // HH:MM (Default "23:59")
    assignedTo: 'MOM' | 'DAD';
    isRecurring: boolean;
    priority: number;   // 0=Standard, 10=Holiday/Override
}
