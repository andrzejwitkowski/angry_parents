const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWeekDays() {
    return (
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {WEEK_DAYS.map((day) => (
                <div
                    key={day}
                    className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest"
                >
                    {day}
                </div>
            ))}
        </div>
    );
}
