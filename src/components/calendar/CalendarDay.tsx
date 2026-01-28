import { format, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { isWeekend } from "@/lib/calendar-utils";
import { DayCellEvents } from "./visuals/DayCellEvents";
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

    // Dynamic Background Style
    let backgroundStyle: React.CSSProperties = {};
    if (isSelectedMonth && daysEntries.length > 0) {
        if (daysEntries.length === 1) {
            // Single parent
            const parent = daysEntries[0].assignedTo;
            backgroundStyle = { backgroundColor: parent === 'MOM' ? 'rgba(255, 192, 203, 0.2)' : 'rgba(135, 206, 235, 0.2)' };
        } else {
            // Split Day
            const firstEnd = daysEntries[0].endTime;
            const [h, m] = firstEnd.split(':').map(Number);
            const minutes = h * 60 + m;
            const percent = Math.round((minutes / 1440) * 100);

            const parent1 = daysEntries[0].assignedTo;
            const color1 = parent1 === 'MOM' ? 'rgba(255, 192, 203, 0.4)' : 'rgba(135, 206, 235, 0.4)';
            const color2 = parent1 === 'MOM' ? 'rgba(135, 206, 235, 0.4)' : 'rgba(255, 192, 203, 0.4)';

            backgroundStyle = {
                background: `linear-gradient(135deg, ${color1} ${percent}%, ${color2} ${percent}%)`
            };
        }
    }

    return (
        <div
            onClick={onClick}
            style={backgroundStyle}
            className={cn(
                "min-h-[140px] p-4 border-r border-b border-slate-100 transition-all duration-300 group relative text-left flex flex-col",
                !isSelectedMonth && "bg-slate-50/50 opacity-40 grayscale-[0.5]",
                isDayWeekend && isSelectedMonth && !backgroundStyle.background && "bg-slate-50/70",
                isSelectedMonth && "hover:bg-white/80 hover:shadow-2xl hover:z-10 hover:border-indigo-100 cursor-pointer active:scale-[0.98]"
            )}
        >
            <div className="flex justify-between items-start">
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

            <div className="mt-2 space-y-1">
                <DayCellEvents events={events} onDayClick={onClick} user={user} />
            </div>
        </div>
    );
}
