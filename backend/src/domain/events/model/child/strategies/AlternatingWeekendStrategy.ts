import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";
import { UuidProvider } from "../../../../shared/ports/UuidProvider";

type Parent = "MOM" | "DAD";
type Assignment = { start: string; end: string; parent: Parent };

const FULL_DAY = (parent: Parent): Assignment[] => [
    { start: "00:00", end: "23:59", parent },
];

const SPLIT_DAY = (
    splitTime: string,
    firstParent: Parent,
    secondParent: Parent
): Assignment[] => [
        { start: "00:00", end: splitTime, parent: firstParent },
        { start: splitTime, end: "23:59", parent: secondParent },
    ];

export class AlternatingWeekendStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig, uuidProvider: UuidProvider): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);

        // startingParent owns the "on" weekends; the other parent holds weekdays.
        const weekendParent = config.startingParent;
        const weekdayParent: Parent = config.startingParent === "MOM" ? "DAD" : "MOM";

        const handoverTime = config.handoverTime ?? "17:00";
        const returnTime = config.handoverEndTime ?? config.handoverTime ?? "09:00";

        // If returnTime is noon or later we treat Sunday as the return day,
        // otherwise the child stays Sunday night and returns Monday morning.
        const returnOnSunday = parseInt(returnTime.split(":")[0], 10) >= 12;

        const anchorDate = new Date((config.anchorDate ?? config.startDate) + "T00:00:00");
        const anchorDayOfWeek = anchorDate.getDay(); // 0=Sun 1=Mon … 5=Fri 6=Sat

        // fridayOffset: Days from the preceding Friday to the anchor date.
        // This ensures the week containing the anchorDate is always the "on" weekend phase (index 0-6).
        // If anchor IS a Friday, fridayOffset = 0.
        // If anchor is Monday, fridayOffset = 3.
        const fridayOffset = (anchorDayOfWeek - 5 + 7) % 7;

        dates.forEach((date) => {
            const current = new Date(date + "T00:00:00");
            const diffDays = Math.round(
                (current.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Normalise to [0, 13] — handles negative diffDays (dates before anchor)
            const cycleDay = ((diffDays % 14) + 14) % 14;

            // Position relative to the "on" Friday in this 14-day cycle:
            //   0 → Friday (On) handover
            //   1 → Saturday (On)
            //   2 → Sunday (On) return or stay
            //   3 → Monday (On) return if !returnOnSunday
            //   4–6 → On week weekdays
            //   7 → Friday (Off)
            //   8 → Saturday (Off)
            //   9 → Sunday (Off)
            //   10 → Monday (Off)
            //   11-13 → Off week weekdays
            const relToFriday = (cycleDay + fridayOffset + 14) % 14;

            console.log(
                `[AltWeekend] Date: ${date}, cycleDay: ${cycleDay}, relToFriday: ${relToFriday}`
            );

            const assignments = this.getAssignmentsForRelativeDay(
                relToFriday,
                weekendParent,
                weekdayParent,
                handoverTime,
                returnTime,
                returnOnSunday
            );

            assignments.forEach((assign) => {
                entries.push({
                    id: uuidProvider.generate(),
                    childId: config.childId,
                    date,
                    startTime: assign.start,
                    endTime: assign.end,
                    assignedTo: assign.parent,
                    isRecurring: true,
                    priority: 0,
                });
            });
        });

        return entries;
    }

    // relToFriday:  0=Fri  1=Sat  2=Sun  3=Mon  4-13=weekday
    private getAssignmentsForRelativeDay(
        relToFriday: number,
        weekendParent: Parent,
        weekdayParent: Parent,
        handoverTime: string,
        returnTime: string,
        returnOnSunday: boolean
    ): Assignment[] {
        switch (relToFriday) {
            case 0: // Friday – handover from weekday → weekend parent at handoverTime
                return SPLIT_DAY(handoverTime, weekdayParent, weekendParent);

            case 1: // Saturday – entirely with weekend parent
                return FULL_DAY(weekendParent);

            case 2: // Sunday – return time depends on returnOnSunday flag
                return returnOnSunday
                    ? SPLIT_DAY(returnTime, weekendParent, weekdayParent)
                    : FULL_DAY(weekendParent); // child stays; return is Monday morning

            case 3: // Monday – return happens here when NOT returning on Sunday
                return returnOnSunday
                    ? FULL_DAY(weekdayParent)
                    : SPLIT_DAY(returnTime, weekendParent, weekdayParent);

            default: // All other days: weekday parent – no handover
                return FULL_DAY(weekdayParent);
        }
    }
}
