import { useState, useEffect, useCallback } from "react";
import { addMonths, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { getCalendarDays } from "@/lib/calendar-utils";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { CalendarWeekDays } from "./calendar/CalendarWeekDays";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { DayDetailsSheet } from "./calendar/day-details/DayDetailsSheet";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem } from "@/types/timeline.types";
import type { User } from '@/types/user';
import type { CustodyEntry } from "@/types/custody";

import type { Child } from "@/lib/api/children";

interface BetterCalendarProps {
    user: User | null;
    refreshKey?: number;
    childrenList?: Child[];
    selectedChildId?: string | null;
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    selectedDateForSheet: Date | null;
    setSelectedDateForSheet: (date: Date | null) => void;
    isSheetOpen: boolean;
    setIsSheetOpen: (open: boolean) => void;
    onDataChange?: () => void;
}

export function BetterCalendar({
    user,
    refreshKey = 0,
    childrenList = [],
    selectedChildId = null,
    currentDate,
    setCurrentDate,
    selectedDateForSheet,
    setSelectedDateForSheet,
    isSheetOpen,
    setIsSheetOpen,
    onDataChange
}: BetterCalendarProps) {
    const [monthEvents, setMonthEvents] = useState<TimelineItem[]>([]);
    const [custodyEntries, setCustodyEntries] = useState<CustodyEntry[]>([]);

    const daysInMonth = getCalendarDays(currentDate);

    const fetchMonthData = useCallback(async () => {
        const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
        const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

        try {
            // Parallel fetch
            const [events, custody] = await Promise.all([
                timelineApi.getByDateRange(start, end),
                fetch(`http://localhost:3000/api/custody?start=${start}&end=${end}`).then(res => res.ok ? res.json() : [])
            ]);

            setMonthEvents(events);
            setCustodyEntries(custody as CustodyEntry[]);
        } catch (error) {
            console.error("Failed to fetch month data:", error);
        }
    }, [currentDate]);

    useEffect(() => {
        // eslint-disable-next-line
        fetchMonthData();
    }, [currentDate, refreshKey, fetchMonthData]);

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
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
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
                events={monthEvents.filter(e => !selectedChildId || e.childIds.includes(selectedChildId))}
                user={user}
                custodyEntries={custodyEntries.filter(e => !selectedChildId || e.childId === selectedChildId)}
                childrenList={childrenList}
            />

            <DayDetailsSheet
                date={selectedDateForSheet}
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                user={user}
                activeChildId={selectedChildId}
                onUpdate={() => {
                    fetchMonthData();
                    if (onDataChange) onDataChange();
                }}
            />
        </div>
    );
}
