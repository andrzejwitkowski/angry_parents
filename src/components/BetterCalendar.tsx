import { useState } from "react";
import { addMonths, subMonths } from "date-fns";
import { getCalendarDays } from "@/lib/calendar-utils";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { CalendarWeekDays } from "./calendar/CalendarWeekDays";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { DayDetailsSheet } from "./calendar/day-details/DayDetailsSheet";
import { useEffect } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem } from "@/types/timeline.types";

interface BetterCalendarProps {
    user: any;
}

export function BetterCalendar({ user }: BetterCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateForSheet, setSelectedDateForSheet] = useState<Date | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [monthEvents, setMonthEvents] = useState<TimelineItem[]>([]);

    const daysInMonth = getCalendarDays(currentDate);

    const fetchMonthEvents = async () => {
        const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
        const end = format(endOfMonth(currentDate), "yyyy-MM-dd");
        try {
            const events = await timelineApi.getByDateRange(start, end);
            setMonthEvents(events);
        } catch (error) {
            console.error("Failed to fetch month events:", error);
        }
    };

    useEffect(() => {
        fetchMonthEvents();
    }, [currentDate]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleDateSelect = (date: Date | undefined) => {
        if (date) setCurrentDate(date);
    };

    const handleDayClick = (date: Date) => {
        setSelectedDateForSheet(date);
        setIsSheetOpen(true);
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

            <CalendarGrid
                days={daysInMonth}
                currentDate={currentDate}
                onDayClick={handleDayClick}
                events={monthEvents}
            />

            <DayDetailsSheet
                date={selectedDateForSheet}
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                user={user}
                onUpdate={fetchMonthEvents}
            />
        </div>
    );
}
