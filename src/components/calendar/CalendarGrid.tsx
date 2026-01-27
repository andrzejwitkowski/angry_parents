import { CalendarDay } from "./CalendarDay";

interface CalendarGridProps {
    days: Date[];
    currentDate: Date;
    onDayClick: (date: Date) => void;
}

export function CalendarGrid({ days, currentDate, onDayClick }: CalendarGridProps) {
    return (
        <div className="flex-1 grid grid-cols-7 h-full overflow-hidden">
            {days.map((day, i) => (
                <CalendarDay
                    key={i}
                    day={day}
                    currentDate={currentDate}
                    onClick={() => onDayClick(day)}
                />
            ))}
        </div>
    );
}
