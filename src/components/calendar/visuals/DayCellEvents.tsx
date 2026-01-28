import type { TimelineItem } from "@/types/timeline.types";
import { EventIndicator } from "./EventIndicator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TimelineItemFactory } from "../day-details/components/TimelineItemFactory";
import { format } from "date-fns";

interface DayCellEventsProps {
    events: TimelineItem[];
    maxVisible?: number;
    onDayClick?: () => void;
}

const TYPE_PRIORITY: Record<string, number> = {
    MEDICAL_VISIT: 0,
    HANDOVER: 1,
    INCIDENT: 2,
    MEDS: 3,
    NOTE: 4,
    VACATION: 5,
    ATTACHMENT: 6,
};

export function DayCellEvents({ events, maxVisible = 3, onDayClick }: DayCellEventsProps) {
    if (events.length === 0) return null;

    // Sort events by priority
    const sortedEvents = [...events].sort((a, b) => {
        const priorityA = TYPE_PRIORITY[a.type] ?? 99;
        const priorityB = TYPE_PRIORITY[b.type] ?? 99;
        return priorityA - priorityB;
    });

    const visibleItems = sortedEvents.slice(0, maxVisible);
    const overflowItems = sortedEvents.slice(maxVisible);
    const dateStr = events[0].date;

    return (
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {visibleItems.map((event) => (
                <EventIndicator key={event.id} event={event} onViewDetails={onDayClick} />
            ))}

            {overflowItems.length > 0 && (
                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center min-w-[28px]"
                        >
                            <span className="text-[10px] font-bold">+{overflowItems.length}</span>
                        </button>
                    </DialogTrigger>
                    <DialogContent
                        className="sm:max-w-lg max-h-[80vh] p-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DialogHeader className="p-6 pb-4 border-b">
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                Events on {format(new Date(dateStr), "MMMM do")}
                            </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] px-6">
                            <div className="space-y-4 py-4">
                                {[...sortedEvents]
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((item) => (
                                        <TimelineItemFactory key={item.id} item={item} />
                                    ))}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
