import type { CustodyEntry } from "@/types/custody";
import { useMemo } from "react";

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
    const backgroundStyle = useMemo(() => {
        if (!entries || entries.length === 0) return {};

        const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Scenario A: Single Entry (Solid)
        if (sorted.length === 1) {
            const parent = sorted[0].assignedTo;
            return {
                backgroundColor: PARENT_COLORS[parent] || 'rgba(0,0,0,0.05)'
            };
        }

        // Scenario B/C: Multi Entry (Gradient)
        // Convert time to percentage (0-1440 mins)
        const stops: string[] = [];

        sorted.forEach((entry) => {
            const startMin = timeToMinutes(entry.startTime);
            const endMin = timeToMinutes(entry.endTime);

            // Adjust endMin for 23:59 to be 100% (1440)
            const effectiveEndMin = endMin >= 1439 ? 1440 : endMin;

            const startPercent = parseFloat(((startMin / 1440) * 100).toFixed(2));
            const endPercent = parseFloat(((effectiveEndMin / 1440) * 100).toFixed(2));

            const color = PARENT_COLORS_SOLID[entry.assignedTo];

            stops.push(`${color} ${startPercent}%`);
            stops.push(`${color} ${endPercent}%`);
        });

        return {
            background: `linear-gradient(135deg, ${stops.join(', ')})`
        };

    }, [entries]);

    // Generate labels
    const labels = useMemo(() => {
        if (!entries || entries.length === 0) return null;
        const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (sorted.length === 1) {
            return (
                <div className="absolute bottom-2 right-3">
                    <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600">
                        {sorted[0].assignedTo}
                    </span>
                </div>
            );
        }

        // Split Day (2+ entries)
        // We assume 2 entries mostly for handover
        // First Entry -> Top Left (below date)
        // Last Entry -> Bottom Right
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        return (
            <>
                <div className="absolute top-12 left-3">
                    <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600">
                        {first.assignedTo}
                    </span>
                </div>
                <div className="absolute bottom-2 right-3">
                    <span className="text-[10px] font-black tracking-widest opacity-50 text-slate-600">
                        {last.assignedTo}
                    </span>
                </div>
            </>
        );
    }, [entries]);

    if (!entries || entries.length === 0) return null;

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
