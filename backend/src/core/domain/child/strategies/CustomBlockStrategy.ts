import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";
import { UuidProvider } from "../../../ports/UuidProvider";

export class CustomBlockStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig, uuidProvider: UuidProvider): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);

        const blockParent = config.startingParent;
        const otherParent = blockParent === 'MOM' ? 'DAD' : 'MOM';

        const handoverTime = config.handoverTime || "17:00";
        const returnTime = config.handoverEndTime || "09:00";

        const repeatInterval = config.customBlockRepeatInterval || 1;
        const repeatUnit = config.customBlockRepeatUnit || 'WEEKS';
        const intervalDays = repeatUnit === 'WEEKS' ? repeatInterval * 7 : repeatInterval;

        const blockEndDayOffset = config.customBlockEndDayOffset || 1;
        const anchorDate = config.anchorDate || config.startDate;

        dates.forEach(date => {
            const start = new Date(anchorDate + "T00:00:00");
            const current = new Date(date + "T00:00:00");
            const diffTime = current.getTime() - start.getTime();

            // If the date is before the config startDate, it shouldn't apply, but TimeUtils.getDatesInRange
            // usually clamps it. We just do diffDays.
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                // Before pattern starts
                entries.push({
                    id: uuidProvider.generate(),
                    childId: config.childId,
                    date: date,
                    startTime: "00:00",
                    endTime: "23:59",
                    assignedTo: otherParent,
                    isRecurring: true,
                    priority: 0
                });
                return;
            }

            const cycleDay = diffDays % intervalDays;

            const assignments: { start: string, end: string, parent: 'MOM' | 'DAD' }[] = [];

            if (cycleDay === 0 && cycleDay === blockEndDayOffset) {
                // Same day block starts and ends on this day
                assignments.push({ start: "00:00", end: handoverTime, parent: otherParent });
                assignments.push({ start: handoverTime, end: returnTime, parent: blockParent });
                assignments.push({ start: returnTime, end: "23:59", parent: otherParent });
            } else if (cycleDay === 0) {
                // Block starts today
                assignments.push({ start: "00:00", end: handoverTime, parent: otherParent });
                assignments.push({ start: handoverTime, end: "23:59", parent: blockParent });
            } else if (cycleDay === blockEndDayOffset) {
                // Block ends today
                assignments.push({ start: "00:00", end: returnTime, parent: blockParent });
                assignments.push({ start: returnTime, end: "23:59", parent: otherParent });
            } else if (cycleDay > 0 && cycleDay < blockEndDayOffset) {
                // Inside the block entirely
                assignments.push({ start: "00:00", end: "23:59", parent: blockParent });
            } else {
                // Outside the block entirely
                assignments.push({ start: "00:00", end: "23:59", parent: otherParent });
            }

            // Clean up any 0-minute intervals (e.g. 00:00 to 00:00)
            const validAssignments = assignments.filter(a => a.start !== a.end);

            validAssignments.forEach((assign) => {
                entries.push({
                    id: uuidProvider.generate(),
                    childId: config.childId,
                    date: date,
                    startTime: assign.start,
                    endTime: assign.end,
                    assignedTo: assign.parent,
                    isRecurring: true,
                    priority: 0
                });
            });
        });

        return entries;
    }
}
