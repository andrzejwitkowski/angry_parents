import type { TimelineItem } from "@/types/timeline.types";
import { TimelineItemFactory } from "./components/TimelineItemFactory";
import { Calendar } from "lucide-react";

interface TimelineFeedProps {
    items: TimelineItem[];
    onItemUpdate?: (updatedItem: TimelineItem) => void;
}

export function TimelineFeed({ items, onItemUpdate }: TimelineFeedProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <Calendar className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No events yet
                </h3>
                <p className="text-sm text-slate-600 max-w-sm">
                    Start logging your day by using the composer below. Add notes, medical visits, handovers, and more.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => (
                <TimelineItemFactory
                    key={item.id}
                    item={item}
                    onUpdate={onItemUpdate}
                />
            ))}
        </div>
    );
}
