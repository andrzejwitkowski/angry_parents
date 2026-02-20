import type { CustodyEntry } from "@/types/custody";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface DayCellBackgroundProps {
    entries: CustodyEntry[];
}

const PARENT_COLORS = {
    MOM: "rgba(236, 72, 153, 0.15)", // Pink-500 low opacity
    DAD: "rgba(79, 70, 229, 0.15)"   // Indigo-600 low opacity
};

// Denser colors for gradient transitions
const PARENT_COLORS_SOLID = {
    MOM: "rgba(236, 72, 153, 0.25)",
    DAD: "rgba(79, 70, 229, 0.25)"
};

export function DayCellBackground({ entries }: DayCellBackgroundProps) {
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

        // Scenario A: Single Entry (Solid)
        if (effectiveEntries.length === 1) {
            const parent = effectiveEntries[0].assignedTo as keyof typeof PARENT_COLORS;
            return {
                backgroundColor: PARENT_COLORS[parent] || 'rgba(0,0,0,0.05)'
            };
        }

        // Scenario B/C: Multi Entry (Gradient)
        // Convert time to percentage (0-1440 mins)
        const stops: string[] = [];

        effectiveEntries.forEach((entry) => {
            const startMin = timeToMinutes(entry.startTime);
            const endMin = timeToMinutes(entry.endTime);

            // Adjust endMin for 23:59 to be 100% (1440)
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

    // Generate labels
    const labels = useMemo(() => {
        if (effectiveEntries.length === 0) return null;

        if (effectiveEntries.length === 1) {
            const entry = effectiveEntries[0];
            const isFullDay = entry.startTime === "00:00" && entry.endTime === "23:59";
            return (
                <div className="absolute bottom-2 right-3 flex flex-col items-end">
                    <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600 uppercase">
                        {t(`scheduler.${entry.assignedTo.toLowerCase()}`)}
                    </span>
                    {!isFullDay && (
                        <span className="text-[8px] font-bold opacity-40 text-slate-500 uppercase">
                            {entry.startTime !== "00:00" ? `(from ${entry.startTime})` : `(until ${entry.endTime})`}
                        </span>
                    )}
                </div>
            );
        }

        // Split Day (2+ entries)
        // We assume 2 entries mostly for handover
        // First Entry -> Top Left (below date)
        // Last Entry -> Bottom Right
        const first = effectiveEntries[0];
        const last = effectiveEntries[effectiveEntries.length - 1];

        // "Recent" label on the ending block of a handover day
        const isRecentEnd = Boolean(last.endTime && last.endTime !== "23:59");

        return (
            <>
                <div className="absolute top-12 left-3 flex flex-col items-start">
                    <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600 uppercase">
                        {t(`scheduler.${first.assignedTo.toLowerCase()}`)}
                    </span>
                    <span className="text-[8px] font-bold opacity-40 text-slate-500 uppercase">
                        (until {first.endTime})
                    </span>
                </div>
                <div className="absolute bottom-2 right-3 flex flex-col items-end">
                    <div className="flex items-center gap-1">
                        {isRecentEnd && (
                            <span className="text-[8px] font-bold px-1 rounded-sm bg-slate-200/50 text-slate-500 uppercase">
                                recent
                            </span>
                        )}
                        <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600 uppercase">
                            {t(`scheduler.${last.assignedTo.toLowerCase()}`)}
                        </span>
                    </div>
                    <span className="text-[8px] font-bold opacity-40 text-slate-500 uppercase">
                        (from {last.startTime})
                    </span>
                </div>
            </>
        );
    }, [effectiveEntries, t]);

    if (effectiveEntries.length === 0) return null;

    return (
        <>
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={backgroundStyle}
                data-testid="day-cell-background"
            />
            {labels}
        </>
    );
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
