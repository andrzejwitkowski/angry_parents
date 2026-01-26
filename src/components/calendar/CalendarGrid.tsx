import { CalendarDay } from "./CalendarDay";

interface CalendarGridProps {
    days: Date[];
    currentDate: Date;
}

export function CalendarGrid({ days, currentDate }: CalendarGridProps) {
    return (
        <div className="flex-1 grid grid-cols-7 h-full overflow-hidden">
            {days.map((day, i) => (
                <CalendarDay key={i} day={day} currentDate={currentDate} />
            ))}
        </div>
    );
}
