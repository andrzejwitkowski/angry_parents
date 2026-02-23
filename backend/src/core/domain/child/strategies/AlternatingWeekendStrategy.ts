import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";
import { UuidProvider } from "../../../ports/UuidProvider";

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

        // startingParent owns the first weekend; the other parent holds weekdays.
        const weekendParent = config.startingParent;
        const weekdayParent: Parent = config.startingParent === "MOM" ? "DAD" : "MOM";

        const handoverTime = config.handoverTime ?? "17:00";
        const returnTime = config.handoverEndTime ?? config.handoverTime ?? "09:00";

        // If returnTime is noon or later we treat Sunday as the return day,
        // otherwise the child stays Sunday night and returns Monday morning.
        const returnOnSunday = parseInt(returnTime.split(":")[0], 10) >= 12;

        const anchorDate = new Date((config.anchorDate ?? config.startDate) + "T00:00:00");

        dates.forEach((date) => {
            const current = new Date(date + "T00:00:00");
            const diffDays = Math.round(
                Math.abs(current.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const cycleDay = diffDays % 14;
            const isWeek1 = cycleDay < 7;
            const dayOfWeek = current.getDay(); // 0=Sun 1=Mon … 5=Fri 6=Sat

            console.log(
                `[AltWeekend] Date: ${date}, cycleDay: ${cycleDay}, isWeek1: ${isWeek1}, dayOfWeek: ${dayOfWeek}`
            );

            const assignments = isWeek1
                ? this.getWeek1Assignments(dayOfWeek, weekendParent, weekdayParent, handoverTime, returnTime, returnOnSunday)
                : this.getWeek2Assignments(weekdayParent);

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

    // ─── Week 1: weekend parent is ON ────────────────────────────────────────

    private getWeek1Assignments(
        dayOfWeek: number,
        weekendParent: Parent,
        weekdayParent: Parent,
        handoverTime: string,
        returnTime: string,
        returnOnSunday: boolean
    ): Assignment[] {
        switch (dayOfWeek) {
            case 5: // Friday – handover from weekday → weekend parent at handoverTime
                return SPLIT_DAY(handoverTime, weekdayParent, weekendParent);

            case 6: // Saturday – entirely with weekend parent
                return FULL_DAY(weekendParent);

            case 0: // Sunday – return time depends on returnOnSunday flag
                return returnOnSunday
                    ? SPLIT_DAY(returnTime, weekendParent, weekdayParent)
                    : FULL_DAY(weekendParent); // child stays; return is Monday morning

            case 1: // Monday – return happens here when NOT returning on Sunday
                return returnOnSunday
                    ? FULL_DAY(weekdayParent)
                    : SPLIT_DAY(returnTime, weekendParent, weekdayParent);

            default: // Tue–Thu: regular weekday, no handover
                return FULL_DAY(weekdayParent);
        }
    }

    // ─── Week 2: "off" weekend – weekday parent holds the whole week ─────────

    private getWeek2Assignments(weekdayParent: Parent): Assignment[] {
        return FULL_DAY(weekdayParent);
    }
}
