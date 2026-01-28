import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TimelineFeed } from "./TimelineFeed";
import { LogComposer } from "./composer/LogComposer";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem } from "@/types/timeline.types";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import type { User } from '@/types/user';

interface DayDetailsSheetProps {
    date: Date | null;
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onUpdate?: () => void;
}

export function DayDetailsSheet({ date, isOpen, onClose, user, onUpdate }: DayDetailsSheetProps) {
    const [items, setItems] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
    const displayDate = date ? format(date, "EEEE, MMMM do, yyyy") : "";

    const fetchItems = async () => {
        if (!formattedDate) return;
        setLoading(true);
        setError(null);
        try {
            const data = await timelineApi.getByDate(formattedDate);
            setItems(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && formattedDate) {
            fetchItems();
        }
    }, [isOpen, formattedDate]);

    const handleItemUpdate = (updatedItem: TimelineItem) => {
        if (!updatedItem?.id) return;
        setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-xl w-full flex flex-col h-full bg-slate-50 overflow-hidden">
                <SheetHeader className="pb-6 border-b border-slate-200">
                    <SheetTitle className="text-2xl font-bold text-slate-900">Day Logbook</SheetTitle>
                    <SheetDescription className="text-slate-600 font-medium">
                        {displayDate}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-6 px-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <p className="text-slate-500 font-medium">Fetching Timeline...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center">
                            {error}
                        </div>
                    ) : (
                        <TimelineFeed
                            items={items}
                            onItemUpdate={handleItemUpdate}
                            onItemDelete={fetchItems}
                            user={user}
                        />
                    )}
                </div>

                <div className="shrink-0 pb-6 pt-4">
                    <LogComposer
                        date={formattedDate}
                        onSuccess={() => {
                            fetchItems();
                            onUpdate?.();
                        }}
                        createdBy={user?.id || "anonymous"}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
