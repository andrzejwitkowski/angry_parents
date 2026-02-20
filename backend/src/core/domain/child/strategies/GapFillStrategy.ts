import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";
import { UuidProvider } from "../../../ports/UuidProvider";

export class GapFillStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig, uuidProvider: UuidProvider): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);

        // Gap Fill is simple: Force the parent on ALL days in range.
        // The conflict resolution engine (ScheduleService) will ensure higher priority rules win.
        // We set priority to -1 so this is the "floor" / default if nothing else exists.

        dates.forEach(date => {
            entries.push({
                id: uuidProvider.generate(),
                childId: config.childId,
                date: date,
                startTime: "00:00",
                endTime: "23:59",
                assignedTo: config.startingParent,
                isRecurring: true,
                priority: -1 // Lowest possible priority
            });
        });

        return entries;
    }
}
