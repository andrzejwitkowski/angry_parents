import type { CustodyEntry } from "@/types/custody";
import type { Child } from "@/lib/api/children";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface DayCellBackgroundProps {
    entries: CustodyEntry[];
    childrenList?: Child[];
    compact?: boolean;
}

const PARENT_COLORS = {
    MOM: "rgba(236, 72, 153, 0.15)", // Pink-500 low opacity
    DAD: "rgba(79, 70, 229, 0.15)"   // Indigo-600 low opacity
};

const PARENT_COLORS_SOLID = {
    MOM: "rgba(236, 72, 153, 0.25)",
    DAD: "rgba(79, 70, 229, 0.25)"
};

interface SingleBackgroundProps {
    entries: CustodyEntry[];
    containerStyle: React.CSSProperties;
    showLabels: boolean;
    compact?: boolean;
    childColor?: string;
}

function SingleChildBackground({ entries, containerStyle, showLabels, compact = false, childColor }: SingleBackgroundProps) {
    const { t } = useTranslation();

    const effectiveEntries = useMemo(() => {
        if (!entries || entries.length === 0) return [];
        let sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (sorted.length === 1) {
            const entry = sorted[0];
            const startMin = timeToMinutes(entry.startTime);
            const endMin = timeToMinutes(entry.endTime);
            if (startMin > 0 || endMin < 1439) {
                const otherParent = entry.assignedTo === 'MOM' ? 'DAD' : 'MOM';
                if (startMin > 0) {
                    sorted.push({ ...entry, assignedTo: otherParent, startTime: "00:00", endTime: entry.startTime });
                }
                if (endMin < 1439) {
                    sorted.push({ ...entry, assignedTo: otherParent, startTime: entry.endTime, endTime: "23:59" });
                }
                sorted.sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
        }
        return sorted;
    }, [entries]);

    const backgroundStyle = useMemo(() => {
        if (effectiveEntries.length === 0) return {};

        if (effectiveEntries.length === 1) {
            const parent = effectiveEntries[0].assignedTo as keyof typeof PARENT_COLORS;
            return {
                backgroundColor: PARENT_COLORS[parent] || 'rgba(0,0,0,0.05)'
            };
        }

        const stops: string[] = [];
        effectiveEntries.forEach((entry) => {
            const startMin = timeToMinutes(entry.startTime);
            const endMin = timeToMinutes(entry.endTime);
            const effectiveEndMin = endMin >= 1439 ? 1440 : endMin;

            const startPercent = parseFloat(((startMin / 1440) * 100).toFixed(2));
            const endPercent = parseFloat(((effectiveEndMin / 1440) * 100).toFixed(2));

            const parent = entry.assignedTo as keyof typeof PARENT_COLORS_SOLID;
            const color = PARENT_COLORS_SOLID[parent];

            stops.push(`${color} ${startPercent}%`);
            stops.push(`${color} ${endPercent}%`);
        });

        return {
            background: `linear-gradient(135deg, ${stops.join(', ')})`
        };

    }, [effectiveEntries]);

    const labels = useMemo(() => {
        if (!showLabels || effectiveEntries.length === 0) return null;

        if (effectiveEntries.length === 1) {
            const entry = effectiveEntries[0];
            const isFullDay = entry.startTime === "00:00" && entry.endTime === "23:59";
            return (
                <div className="absolute bottom-1 right-2 flex flex-col items-end">
                    <span className={compact ? "text-[8px] font-black tracking-widest opacity-60 text-slate-600 uppercase" : "text-[9px] font-black tracking-widest opacity-60 text-slate-600 uppercase"}>
                        {t(`scheduler.${entry.assignedTo.toLowerCase()}`)}
                    </span>
                    {!isFullDay && !compact && (
                        <span className="text-[7px] font-bold opacity-50 text-slate-500 uppercase">
                            {entry.startTime !== "00:00" ? `(from ${entry.startTime})` : `(until ${entry.endTime})`}
                        </span>
                    )}
                </div>
            );
        }

        const first = effectiveEntries[0];
        const last = effectiveEntries[effectiveEntries.length - 1];
        const isRecentEnd = Boolean(last.endTime && last.endTime !== "23:59");

        return (
            <>
                <div className="absolute top-1 left-2 flex flex-col items-start">
                    <span className={compact ? "text-[8px] font-black tracking-widest opacity-60 text-slate-600 uppercase" : "text-[9px] font-black tracking-widest opacity-60 text-slate-600 uppercase"}>
                        {t(`scheduler.${first.assignedTo.toLowerCase()}`)}
                    </span>
                    {!compact && (
                        <span className="text-[7px] font-bold opacity-50 text-slate-500 uppercase">
                            (until {first.endTime})
                        </span>
                    )}
                </div>
                <div className="absolute bottom-1 right-2 flex flex-col items-end">
                    <div className="flex items-center gap-1">
                        {isRecentEnd && !compact && (
                            <span className="text-[7px] font-bold px-1 rounded-sm bg-slate-200/50 text-slate-500 uppercase">
                                recent
                            </span>
                        )}
                        <span className={compact ? "text-[8px] font-black tracking-widest opacity-60 text-slate-600 uppercase" : "text-[9px] font-black tracking-widest opacity-60 text-slate-600 uppercase"}>
                            {t(`scheduler.${last.assignedTo.toLowerCase()}`)}
                        </span>
                    </div>
                    {!compact && (
                        <span className="text-[7px] font-bold opacity-50 text-slate-500 uppercase">
                            (from {last.startTime})
                        </span>
                    )}
                </div>
            </>
        );
    }, [effectiveEntries, showLabels, t]);

    const borderStyle = useMemo(() => {
        if (!childColor) return {};
        return {
            borderColor: childColor,
            borderWidth: '2px',
            borderStyle: 'solid',
            borderRadius: '4px'
        };
    }, [childColor]);

    return (
        <div className="absolute pointer-events-none z-0 border-b border-white/20 last:border-0" style={{ ...containerStyle, ...borderStyle }}>
            <div className="absolute inset-0" style={backgroundStyle} />
            {labels}
        </div>
    );
}

export function DayCellBackground({ entries, childrenList = [], compact = false }: DayCellBackgroundProps) {
    const entryGroups = useMemo(() => {
        if (entries.length === 0) return [];

        const grouped: Record<string, CustodyEntry[]> = {};
        entries.forEach(e => {
            if (!grouped[e.childId]) grouped[e.childId] = [];
            grouped[e.childId].push(e);
        });

        // Group by childrenList order if available, else just what's there
        if (childrenList.length > 0) {
            return childrenList.map(c => grouped[c.id]).filter(g => g && g.length > 0);
        }
        return Object.values(grouped);
    }, [entries, childrenList]);

    if (entryGroups.length === 0) return null;

    const count = entryGroups.length;
    const heightPercent = 100 / count;

    return (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-md pointer-events-none" data-testid="day-cell-background">
            {entryGroups.map((group, index) => {
                const childId = group[0].childId;
                const child = childrenList.find(c => c.id === childId);
                const childColor = count > 1 ? child?.color : undefined;

                const style: React.CSSProperties = {
                    top: `${index * heightPercent}%`,
                    height: `${heightPercent}%`,
                    left: 0,
                    right: 0
                };

                // Only show labels on the first one or if we have plenty of room
                // For a split cell (2+ kids), the labels might overlap but we made them smaller and positioned them carefully.
                // We'll show labels on all splits to indicate whose time is whose.
                return (
                    <SingleChildBackground
                        key={childId}
                        entries={group}
                        containerStyle={style}
                        showLabels={true}
                        compact={compact}
                        childColor={childColor}
                    />
                );
            })}
        </div>
    );
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
