import { expect, test, describe } from "bun:test";
import { getCalendarDays, isWeekend, getMonthYearLabel } from "./calendar-utils";
import { isSameDay } from "date-fns";

describe("calendar-utils", () => {
    test("getCalendarDays returns correct number of days for January 2026", () => {
        const date = new Date(2026, 0, 1); // Jan 1, 2026
        const days = getCalendarDays(date);

        // Jan 2026 starts on Thursday. 
        // The calendar grid usually starts on Sunday.
        // Dec 28, 29, 30, 31 (4 days) + Jan (31 days) = 35 days (5 weeks)
        expect(days.length).toBe(35);
        expect(isSameDay(days[0], new Date(2025, 11, 28))).toBe(true);
        expect(isSameDay(days[34], new Date(2026, 0, 31))).toBe(true);
    });

    test("isWeekend correctly identifies Saturday and Sunday", () => {
        const saturday = new Date(2026, 0, 3);
        const sunday = new Date(2026, 0, 4);
        const monday = new Date(2026, 0, 5);

        expect(isWeekend(saturday)).toBe(true);
        expect(isWeekend(sunday)).toBe(true);
        expect(isWeekend(monday)).toBe(false);
    });

    test("getMonthYearLabel returns correctly formatted string", () => {
        const date = new Date(2026, 0, 1);
        expect(getMonthYearLabel(date)).toBe("January 2026");
    });
});
