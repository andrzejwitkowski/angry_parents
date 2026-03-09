import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TimelineFeed } from "./TimelineFeed";
import { LogComposer } from "./composer/LogComposer";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem } from "@/types/timeline.types";
import { format } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { User } from '@/types/user';
import { useChildren } from "@/hooks/useChildren";
import { useSecurity } from "@/context/SecurityContext";

interface DayDetailsSheetProps {
    date: Date | null;
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    activeChildId?: string | null;
    onUpdate?: () => void;
}

export function DayDetailsSheet({ date, isOpen, onClose, user, activeChildId: externalChildId, onUpdate }: DayDetailsSheetProps) {
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'pl' ? pl : enUS;
    const { isLocked } = useSecurity();

    const [items, setItems] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [internalChildId, setInternalChildId] = useState<string | null>(null);
    const fetchVersionRef = useRef(0);

    const { children } = useChildren();

    // Sync internal child id with external prop OR auto-pick first child
    useEffect(() => {
        if (externalChildId) {
            setInternalChildId(externalChildId);
        } else if (children.length > 0 && !internalChildId) {
            setInternalChildId(children[0].id);
        }
    }, [externalChildId, children, internalChildId]);

    const activeChildId = externalChildId ?? internalChildId;

    const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
    const displayDate = date ? format(date, "EEEE, do LLLL yyyy", { locale: currentLocale }) : "";

    const fetchItems = useCallback(async () => {
        if (!formattedDate || isLocked) return;
        const fetchVersion = ++fetchVersionRef.current;
        setLoading(true);
        setError(null);
        try {
            const data = await timelineApi.getByDate(formattedDate);
            if (isLocked || fetchVersion !== fetchVersionRef.current) {
                return;
            }
            setItems(data);
        } catch (err) {
            if (!isLocked && fetchVersion === fetchVersionRef.current) {
                setError(err instanceof Error ? err.message : "Failed to load events");
            }
        } finally {
            if (!isLocked && fetchVersion === fetchVersionRef.current) {
                setLoading(false);
            }
        }
    }, [formattedDate, isLocked]);

    useEffect(() => {
        if (isOpen && formattedDate && !isLocked) {
            fetchItems();
        }
    }, [isOpen, formattedDate, isLocked, fetchItems]);

    useEffect(() => {
        if (!isLocked) {
            return;
        }

        setItems([]);
        setError(null);
        setLoading(false);
        fetchVersionRef.current += 1;
        onClose();
    }, [isLocked, onClose]);

    const handleItemUpdate = (updatedItem: TimelineItem) => {
        if (!updatedItem?.id) return;
        setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent data-testid="day-details-sheet" className="sm:max-w-xl w-full flex flex-col h-full bg-slate-50 overflow-hidden">
                <SheetHeader className="pb-6 border-b border-slate-200">
                    <SheetTitle className="text-2xl font-bold text-slate-900">{t("daylog.title")}</SheetTitle>
                    <SheetDescription className="text-slate-600 font-medium capitalize">
                        {displayDate}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-6 px-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <p className="text-slate-500 font-medium">{t("daylog.fetching")}</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center">
                            {t("daylog.failedToLoad")}
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
                    {activeChildId ? (
                        <LogComposer
                            date={formattedDate}
                            onSuccess={() => {
                                fetchItems();
                                onUpdate?.();
                            }}
                            createdBy={user?.id || "anonymous"}
                            childId={activeChildId}
                        />
                    ) : (
                        <div className="text-center text-slate-500 italic p-4">
                            {t("daylog.selectChildToAddEvents")}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
