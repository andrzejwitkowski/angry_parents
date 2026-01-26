import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface CalendarHeaderProps {
    currentDate: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onDateSelect: (date: Date | undefined) => void;
}

export function CalendarHeader({
    currentDate,
    onPrevMonth,
    onNextMonth,
    onDateSelect,
}: CalendarHeaderProps) {
    return (
        <div className="flex items-center justify-between p-8 bg-slate-50 border-b border-slate-200">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight capitalize">
                {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevMonth}
                    className="rounded-xl hover:bg-slate-100 h-10 w-10"
                    aria-label="Previous Month"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-10 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 gap-2 border-x border-slate-100"
                        >
                            <CalendarIcon className="h-4 w-4" />
                            Custom Month
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="center">
                        <Calendar
                            mode="single"
                            selected={currentDate}
                            onSelect={onDateSelect}
                            initialFocus
                            className="rounded-2xl"
                        />
                    </PopoverContent>
                </Popover>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNextMonth}
                    className="rounded-xl hover:bg-slate-100 h-10 w-10"
                    aria-label="Next Month"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
