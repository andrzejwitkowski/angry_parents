import { format, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { isWeekend } from "@/lib/calendar-utils";
import { DayCellEvents } from "./visuals/DayCellEvents";
import { DayCellBackground } from "./visuals/DayCellBackground";
import type { TimelineItem } from "@/types/timeline.types";

import type { User } from '@/types/user';
import type { CustodyEntry } from '@/types/custody';

interface CalendarDayProps {
    day: Date;
    currentDate: Date;
    events: TimelineItem[];
    onClick: () => void;
    user: User | null;
    custodyEntries?: CustodyEntry[];
}

export function CalendarDay({ day, currentDate, events, onClick, user, custodyEntries = [] }: CalendarDayProps) {
    const isSelectedMonth = isSameMonth(day, currentDate);
    const isDayWeekend = isWeekend(day);
    const isDayToday = isToday(day);

    // Filter custody entries for this day
    const dayStr = format(day, 'yyyy-MM-dd');
    const daysEntries = custodyEntries.filter(e => e.date === dayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

    return (
        <div
            onClick={onClick}
            className={cn(
                "min-h-[140px] p-4 border-r border-b border-slate-100 transition-all duration-300 group relative text-left flex flex-col hover:z-10",
                !isSelectedMonth && "bg-slate-50/50 opacity-40 grayscale-[0.5]",
                isDayWeekend && isSelectedMonth && "bg-slate-50/70",
                isSelectedMonth && "hover:bg-white/80 hover:shadow-2xl hover:border-indigo-100 cursor-pointer active:scale-[0.98]"
            )}
        >
            {/* Background Layer */}
            {isSelectedMonth && <DayCellBackground entries={daysEntries} />}

            {/* Content Layer */}
            <div className="relative z-10 flex justify-between items-start">
                <span
                    className={cn(
                        "text-lg font-bold w-10 h-10 flex items-center justify-center rounded-2xl transition-all",
                        isDayToday
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                            : "text-slate-600"
                    )}
                >
                    {format(day, "d")}
                </span>

                {isDayToday && (
                    <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">
                        Today
                    </span>
                )}
            </div>

            <div className="relative z-10 mt-2 space-y-1 flex-1">
                <DayCellEvents events={events} onDayClick={onClick} user={user} />
            </div>

            {/* Avatars Removed as per user request (replaced by labels in Background) */}
        </div>
    );
}
