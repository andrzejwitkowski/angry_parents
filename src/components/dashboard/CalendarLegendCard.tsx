import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import type { Child } from "@/lib/api/children";
import { format } from "date-fns";
import { NextUpWidget } from "./NextUpWidget";

interface CalendarLegendCardProps {
    childrenList: Child[];
    selectedChildId: string | null;
    currentDate: Date;
    calendarRefreshKey: number;
}

export function CalendarLegendCard({ childrenList, selectedChildId, currentDate, calendarRefreshKey }: CalendarLegendCardProps) {
    const { t } = useTranslation();

    const displayedChildren = selectedChildId
        ? childrenList.filter(c => c.id === selectedChildId)
        : childrenList;

    const childrenNames = displayedChildren.map(c => c.name).join(" " + t("common.and") + " ");
    const monthYear = format(currentDate, "MMMM yyyy");

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-stretch overflow-hidden">
            {/* Legend Section (Left) */}
            <div className="flex-1 p-5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <ClipboardList className="w-6 h-6" />
                    </div>

                    <div className="space-y-3">
                        {/* Legend Row */}
                        <div className="flex flex-wrap items-center gap-6">
                            {/* Mom/Dad Custody Legend */}
                            <div className="flex items-center gap-4 border-r border-slate-200 dark:border-slate-700 pr-6">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <div className="w-4 h-4 rounded-sm bg-pink-100 border border-pink-200 dark:bg-pink-900/30 dark:border-pink-800 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {t('scheduler.mom_genitive')} Time
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <div className="w-4 h-4 rounded-sm bg-indigo-100 border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {t('scheduler.dad_genitive')} Time
                                    </span>
                                </div>
                            </div>

                            {/* Children Activities Legend */}
                            <div className="flex flex-wrap items-center gap-4">
                                {displayedChildren.map(child => (
                                    <div key={child.id} className="flex items-center gap-2 whitespace-nowrap">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: child.color || '#cbd5e1' }}
                                        />
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                            {child.name}'s Activities
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Description Text */}
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            Showing schedule for {displayedChildren.length > 1 ? "both " : ""}
                            {childrenNames} for {monthYear}.
                        </p>
                    </div>
                </div>
            </div>

            {/* Next Up Section (Right) */}
            <div className="w-[350px] shrink-0 border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <NextUpWidget refreshKey={calendarRefreshKey} />
            </div>
        </div>
    );
}
