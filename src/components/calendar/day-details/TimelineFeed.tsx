import type { TimelineItem } from "@/types/timeline.types";
import { TimelineItemFactory } from "./components/TimelineItemFactory";
import { Calendar, AlertCircle } from "lucide-react";
import type { User } from '@/types/user';
import { useTranslation } from "react-i18next";

interface TimelineFeedProps {
    items: TimelineItem[];
    onItemUpdate: (item: TimelineItem) => void;
    onItemDelete: (id: string) => void;
    user: User | null;
}

export function TimelineFeed({ items, onItemUpdate, onItemDelete, user }: TimelineFeedProps) {
    const { t } = useTranslation();

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

    const modifiedItems = items.filter(item => item.auditTrail.length > 1);

    return (
        <div className="space-y-4">
            {modifiedItems.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg shadow-sm animate-in slide-in-from-top-4 duration-500">
                    <div className="p-1.5 bg-amber-500 rounded-full">
                        <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm font-medium text-amber-900">
                        {modifiedItems.length === 1
                            ? "One entry on this day has been modified"
                            : `${modifiedItems.length} entries on this day have been modified`}
                    </p>
                </div>
            )}

            {items.map((item) => (
                <TimelineItemFactory
                    key={item.id}
                    item={item}
                    onUpdate={onItemUpdate}
                    onDelete={() => onItemDelete(item.id)}
                    user={user}
                />
            ))}
        </div>
    );
}
