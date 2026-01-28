import type { TimelineItem } from "@/types/timeline.types";
import { CalendarDay } from "./CalendarDay";
import { format } from "date-fns";

import type { User } from '@/types/user';

interface CalendarGridProps {
    days: Date[];
    currentDate: Date;
    events: TimelineItem[];
    onDayClick: (date: Date) => void;
    user: User | null;
    custodyEntries?: CustodyEntry[];
}

export function CalendarGrid({ days, currentDate, events, onDayClick, user, custodyEntries = [] }: CalendarGridProps) {
    return (
        <div className="flex-1 grid grid-cols-7 h-full overflow-hidden">
            {days.map((day, i) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayEvents = events.filter((e) => e.date === dateStr);

                return (
                    <CalendarDay
                        key={i}
                        day={day}
                        currentDate={currentDate}
                        onClick={() => onDayClick(day)}
                        events={dayEvents}
                        user={user}
                        custodyEntries={custodyEntries}
                    />
                );
            })}
        </div>
    );
}
