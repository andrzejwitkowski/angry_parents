import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isWeekend as dateFnsIsWeekend
} from "date-fns";

export function getCalendarDays(date: Date) {
    return eachDayOfInterval({
        start: startOfWeek(startOfMonth(date)),
        end: endOfWeek(endOfMonth(date)),
    });
}

export function isWeekend(date: Date): boolean {
    return dateFnsIsWeekend(date);
}

export function getMonthYearLabel(date: Date): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}
