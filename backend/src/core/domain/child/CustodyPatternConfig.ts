import { PatternType } from "./CustodyEntry";

export interface CustodyPatternConfig {
    childId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    type: PatternType;
    startingParent: 'MOM' | 'DAD';
    handoverTime?: string; // e.g. "17:00". Crucial for split days.
    sequence?: number[];   // For 2-2-3 (e.g. [2, 2, 3])
    holidays?: string[];   // List of dates for Holiday Override
}
