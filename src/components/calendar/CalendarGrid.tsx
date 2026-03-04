import type { TimelineItem } from "@/types/timeline.types";
import { CalendarDay } from "./CalendarDay";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import type { User } from '@/types/user';
import type { CustodyEntry } from '@/types/custody';
import type { Child } from '@/lib/api/children';

interface CalendarGridProps {
    days: Date[];
    currentDate: Date;
    events: TimelineItem[];
    onDayClick: (date: Date) => void;
    user: User | null;
    custodyEntries?: CustodyEntry[];
    childrenList?: Child[];
    compact?: boolean;
}

export function CalendarGrid({ days, currentDate, events, onDayClick, user, custodyEntries = [], childrenList = [], compact = false }: CalendarGridProps) {
    const weeks = Math.ceil(days.length / 7);

    return (
        <div
            data-testid="calendar-grid"
            className={cn(
                "w-full grid grid-cols-7 overflow-hidden",
                compact ? "" : "flex-1 h-full"
            )}
            style={{ gridTemplateRows: `repeat(${weeks}, ${compact ? 'minmax(60px, max-content)' : 'minmax(0, 1fr)'})` }}
        >
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
                        childrenList={childrenList}
                        compact={compact}
                    />
                );
            })}
        </div>
    );
}
