import { CustodyPatternConfig } from "./CustodyPatternConfig";

export interface ScheduleRule {
    id: string;
    childId: string;
    name: string;
    config: CustodyPatternConfig;
    priority: number;
    isOneTime: boolean;
    createdAt: string;
}
