import { format, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { isWeekend } from "@/lib/calendar-utils";

interface CalendarDayProps {
    day: Date;
    currentDate: Date;
}

export function CalendarDay({ day, currentDate }: CalendarDayProps) {
    const isSelectedMonth = isSameMonth(day, currentDate);
    const isDayWeekend = isWeekend(day);
    const isDayToday = isToday(day);

    return (
        <div
            className={cn(
                "min-h-[140px] p-4 border-r border-b border-slate-100 transition-colors group relative text-left",
                !isSelectedMonth && "bg-slate-50/50 opacity-40 grayscale-[0.5]",
                isDayWeekend && isSelectedMonth && "bg-slate-50/70",
                isSelectedMonth && "hover:bg-indigo-50/30 cursor-pointer"
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
                {/* Future events placeholders */}
            </div>
        </div>
    );
}
