import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";

export class AlternatingWeekendStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);

        // Default parent is the non-starting parent (Usually A has week, B has weekend)
        // Or if config.startingParent = MOM, does that mean MOM has the FIRST weekend?
        // Let's assume startingParent OWNS the weekend.
        const weekendParent = config.startingParent;
        const weekdayParent = config.startingParent === 'MOM' ? 'DAD' : 'MOM';

        // 14-day cycle reference. Start date is day 0.
        // Assuming StartDate is FRIDAY as per Use Case 1.
        // Week 1 (Day 0-6): WeekendParent has Fri-Sun.
        // Week 2 (Day 7-13): WeekdayParent has Fri-Sun.

        const handoverTime = config.handoverTime || "17:00"; // Default 5pm
        const returnTime = config.handoverTime || "09:00"; // Use handover time for return as well, fallback to default if needed

        dates.forEach(date => {
            // Calculate days difference from start
            const start = new Date(config.startDate);
            const current = new Date(date);
            const diffTime = Math.abs(current.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const cycleDay = diffDays % 14;
            const isWeek1 = cycleDay < 7;
            const dayOfWeek = current.getDay(); // 0=Sun, 5=Fri, 6=Sat, 1=Mon

            let assignments: { start: string, end: string, parent: 'MOM' | 'DAD' }[] = [];

            // Logic for "Standard" Alternating Weekend starting on Friday
            // Week 1: Weekend Parent ON.
            if (isWeek1) {
                if (dayOfWeek === 5) { // Friday
                    // 00-17: WeekdayParent, 17-24: WeekendParent
                    assignments.push({ start: "00:00", end: handoverTime, parent: weekdayParent });
                    assignments.push({ start: handoverTime, end: "23:59", parent: weekendParent });
                } else if (dayOfWeek === 6 || dayOfWeek === 0) { // Sat/Sun
                    // Full WeekendParent
                    assignments.push({ start: "00:00", end: "23:59", parent: weekendParent });
                } else if (dayOfWeek === 1) { // Monday
                    // Return day. 00-09 WeekendParent, 09-24 WeekdayParent
                    assignments.push({ start: "00:00", end: returnTime, parent: weekendParent });
                    assignments.push({ start: returnTime, end: "23:59", parent: weekdayParent });
                } else {
                    // Tue-Thu: WeekdayParent
                    assignments.push({ start: "00:00", end: "23:59", parent: weekdayParent });
                }
            } else {
                // Week 2: "OFF" Weekend. WeekdayParent has everything.
                // Wait, Week 2 Friday? Is it split? No, usually "Off" weekend means continuous custody for primary.
                assignments.push({ start: "00:00", end: "23:59", parent: weekdayParent });
            }

            // Create entries
            assignments.forEach((assign, index) => {
                entries.push({
                    id: crypto.randomUUID(),
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
