import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";

export class HolidayStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        // If holidays array is provided, iterate specific dates.
        // If not, use date range.

        const targetDates = config.holidays && config.holidays.length > 0
            ? config.holidays
            : TimeUtils.getDatesInRange(config.startDate, config.endDate);

        targetDates.forEach(date => {
            entries.push({
                id: crypto.randomUUID(),
                childId: config.childId,
                date: date,
                startTime: "00:00",
                endTime: "23:59",
                assignedTo: config.startingParent,
                isRecurring: true,
                priority: 10 // High priority
            });
        });

        return entries;
    }
}
