import { useState } from "react";
import { addMonths, subMonths } from "date-fns";
import { getCalendarDays } from "@/lib/calendar-utils";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { CalendarWeekDays } from "./calendar/CalendarWeekDays";
import { CalendarGrid } from "./calendar/CalendarGrid";

export function BetterCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = getCalendarDays(currentDate);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleDateSelect = (date: Date | undefined) => {
        if (date) setCurrentDate(date);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <CalendarHeader
                currentDate={currentDate}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onDateSelect={handleDateSelect}
            />

            <CalendarWeekDays />

            <CalendarGrid days={daysInMonth} currentDate={currentDate} />
        </div>
    );
}
