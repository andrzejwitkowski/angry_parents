import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format, addMonths, subMonths, isSameMonth } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarWeekDays } from "../calendar/CalendarWeekDays";
import { CalendarGrid } from "../calendar/CalendarGrid";
import { getCalendarDays } from "@/lib/calendar-utils";
import type { CustodyEntry, CustodyPatternConfig } from "@/types/custody";
import type { Child } from "@/lib/api/children";

interface CustodyPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    entries: CustodyEntry[];
    config: Partial<CustodyPatternConfig>;
    selectedChild: Child | null;
    onConfirm: () => void;
    isLoading: boolean;
}

export function CustodyPreviewModal({
    isOpen,
    onClose,
    entries,
    config,
    selectedChild,
    onConfirm,
    isLoading
}: CustodyPreviewModalProps) {
    const { t } = useTranslation();

    // Default to the config start date or today
    const [currentDate, setCurrentDate] = useState<Date>(() => {
        return config.startDate ? new Date(config.startDate) : new Date();
    });

    // Extract month navigation
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Calendar days for the current view
    const daysInMonth = useMemo(() => getCalendarDays(currentDate), [currentDate]);

    // Map the selected child to array for CalendarGrid
    const childrenList = useMemo(() => selectedChild ? [selectedChild] : [], [selectedChild]);

    // Generate explanations based on the config
    const explanations = useMemo(() => {
        if (entries.length === 0) return [];

        const textExplanations = [];

        if (config.type === 'ALTERNATING_WEEKEND') {
            textExplanations.push(t("scheduler.previewAltWeekendExplanation", {
                parent: t(`scheduler.${config.startingParent?.toLowerCase() || 'dad'}`),
                start: config.startDate,
                end: config.endDate
            }));
        } else if (config.type === 'CUSTOM_BLOCK') {
            textExplanations.push(t("scheduler.previewCustomBlockExplanation", {
                parent: t(`scheduler.${config.startingParent?.toLowerCase() || 'dad'}`),
                duration: config.customBlockEndDayOffset || 1,
                interval: config.customBlockRepeatInterval || 1,
                unit: t(`scheduler.${(config.customBlockRepeatUnit || 'WEEKS').toLowerCase()}`)
            }));
        } else if (config.type === 'CUSTOM_SEQUENCE') {
            textExplanations.push(t("scheduler.previewCustomSequenceExplanation", {
                sequence: config.sequence?.join(', ') || ''
            }));
        }

        // Count entries in this visible month to give context
        const entriesThisMonth = entries.filter(e => isSameMonth(new Date(e.date), currentDate));
        textExplanations.push(t("scheduler.previewEntriesThisMonth", { count: entriesThisMonth.length }));

        return textExplanations;
    }, [entries, config, currentDate, t]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 bg-slate-50 overflow-hidden">
                <DialogHeader className="shrink-0 flex flex-row items-center justify-between">
                    <div className="flex flex-col space-y-1.5">
                        <DialogTitle className="text-xl flex items-center gap-2 text-indigo-900">
                            <CalendarIcon className="w-5 h-5 text-indigo-600" />
                            {t("scheduler.previewScheduleTitle")}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {t("scheduler.previewScheduleDesc")}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
                    {/* Left: Mini Calendar */}
                    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 hover:bg-slate-100">
                                <ChevronLeft className="w-4 h-4 text-slate-600" />
                            </Button>
                            <span className="font-semibold text-slate-800 tabular-nums tracking-wide">
                                {format(currentDate, "MMMM yyyy")}
                            </span>
                            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 hover:bg-slate-100">
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                            </Button>
                        </div>

                        <div className="shrink-0 bg-slate-50/50">
                            <CalendarWeekDays />
                        </div>

                        {/* 
                            We reuse CalendarGrid. Since we only want to show the blocks, 
                            events are empty.
                        */}
                        <div className="flex-1 overflow-y-auto">
                            <CalendarGrid
                                days={daysInMonth}
                                currentDate={currentDate}
                                events={[]}
                                onDayClick={() => { }} // No-op in preview
                                user={null}
                                custodyEntries={entries}
                                childrenList={childrenList}
                                compact={true}
                            />
                        </div>
                    </div>

                    {/* Right: Explanations and actions */}
                    <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1 overflow-hidden flex flex-col">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3 shrink-0">
                                <Info className="w-4 h-4 text-indigo-500" />
                                {t("scheduler.detectedBlocks")}
                            </h3>

                            <ScrollArea className="flex-1 pr-4">
                                <div className="space-y-4">
                                    {explanations.map((text, idx) => (
                                        <div key={idx} className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50 text-sm text-slate-700 leading-relaxed">
                                            {text}
                                        </div>
                                    ))}

                                    {entries.length > 0 && (
                                        <div className="mt-6 pt-4 border-t border-slate-100">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                {t("scheduler.totalEntriesSummary")}
                                            </h4>
                                            <div className="flex gap-4">
                                                <div className="p-3 bg-pink-50 rounded-lg flex-1 text-center">
                                                    <div className="text-xs font-medium text-pink-600 uppercase tracking-wider mb-1">{t("scheduler.mom")}</div>
                                                    <div className="text-xl font-bold text-pink-700">
                                                        {entries.filter(e => e.assignedTo === 'MOM').length}
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-indigo-50 rounded-lg flex-1 text-center">
                                                    <div className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">{t("scheduler.dad")}</div>
                                                    <div className="text-xl font-bold text-indigo-700">
                                                        {entries.filter(e => e.assignedTo === 'DAD').length}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <div className="flex gap-3 justify-end shrink-0">
                            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
                                {t("scheduler.cancel")}
                            </Button>
                            <Button
                                onClick={onConfirm}
                                disabled={isLoading || entries.length === 0}
                                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200"
                            >
                                {isLoading ? t("scheduler.saving") : t("scheduler.confirmSave")}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
