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
import type { User } from '@/types/user';

interface BetterCalendarProps {
    user: User | null;
    refreshKey?: number;
}

export function BetterCalendar({ user, refreshKey = 0 }: BetterCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateForSheet, setSelectedDateForSheet] = useState<Date | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [monthEvents, setMonthEvents] = useState<TimelineItem[]>([]);
    const [custodyEntries, setCustodyEntries] = useState<any[]>([]); // Using any[] for now or import CustodyEntry

    const daysInMonth = getCalendarDays(currentDate);

    const fetchMonthData = async () => {
        const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
        const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

        try {
            // Parallel fetch
            const [events, custody] = await Promise.all([
                timelineApi.getByDateRange(start, end),
                fetch(`http://localhost:3000/api/custody?start=${start}&end=${end}`).then(res => res.ok ? res.json() : [])
            ]);

            setMonthEvents(events);
            setCustodyEntries(custody as any[]);
        } catch (error) {
            console.error("Failed to fetch month data:", error);
        }
    };

    useEffect(() => {
        fetchMonthData();
    }, [currentDate, refreshKey]);

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
                user={user}
                custodyEntries={custodyEntries}
            />

            <DayDetailsSheet
                date={selectedDateForSheet}
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                user={user}
                onUpdate={fetchMonthData}
            />
        </div>
    );
}
