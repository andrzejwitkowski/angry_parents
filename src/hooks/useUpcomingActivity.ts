import { useState, useEffect } from "react";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem, HandoverItem, MedicalVisitItem, MedsItem } from "@/types/timeline.types";
import type { CustodyEntry } from "@/types/custody";
import { format, endOfWeek, subDays } from "date-fns";

export type UpcomingActivityType = HandoverItem | MedicalVisitItem | MedsItem;

// Activity types shown in the Next Up widget (from timeline)
const SHOWN_TYPES = new Set<TimelineItem["type"]>(["HANDOVER", "MEDICAL_VISIT", "MEDS"]);

function toSortKey(item: TimelineItem): string {
    const time = item.type === "HANDOVER" ? (item as HandoverItem).time : "00:00";
    return `${item.date}T${time}`;
}

function findNextCustodyHandover(
    entries: CustodyEntry[],
    today: string,
    currentTime: string
): HandoverItem | null {
    if (!entries || entries.length === 0) return null;

    // Sort by date and then startTime
    const sorted = [...entries].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    let prevParent: "MOM" | "DAD" | null = null;

    for (const cur of sorted) {
        if (prevParent !== null && cur.assignedTo !== prevParent) {
            // It's a handover!
            // Check if it's in the future (today after currentTime, or later days)
            // We use 00:00 as start of day for transition comparisons.
            if (cur.date > today || (cur.date === today && cur.startTime >= currentTime)) {
                const handoverTime = cur.startTime && cur.startTime !== "00:00" ? cur.startTime : "17:00";
                return {
                    id: `custody-handover-${cur.date}-${cur.startTime}`,
                    type: "HANDOVER",
                    encryption: "PLAINTEXT",
                    date: cur.date,
                    time: handoverTime,
                    location: "",
                    status: "PENDING",
                    childIds: [],
                    createdAt: new Date().toISOString(),
                    createdBy: "system",
                    auditTrail: [],
                    isDeleted: false,
                    assignedTo: cur.assignedTo,
                } as HandoverItem & { assignedTo: "MOM" | "DAD" };
            }
        }
        prevParent = cur.assignedTo;
    }

    return null;
}

export interface UseUpcomingActivityResult {
    nextActivity: UpcomingActivityType | null;
    isLoading: boolean;
    error: string | null;
}

export function useUpcomingActivity(refreshKey?: number): UseUpcomingActivityResult {
    const [nextActivity, setNextActivity] = useState<UpcomingActivityType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);

            const now = new Date();
            const today = format(now, "yyyy-MM-dd");
            const currentTime = format(now, "HH:mm");
            const yesterday = format(subDays(now, 1), "yyyy-MM-dd");
            const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

            try {
                // Fetch both in parallel
                const [timelineItems, custodyEntries] = await Promise.all([
                    timelineApi.getByDateRange(today, weekEnd),
                    fetch(`/api/custody?start=${yesterday}&end=${weekEnd}`)
                        .then(r => r.ok ? r.json() as Promise<CustodyEntry[]> : Promise.resolve([] as CustodyEntry[]))
                        .catch(() => [] as CustodyEntry[])
                ]);

                if (cancelled) return;

                // 1. Upcoming timeline activities (HANDOVER / MEDICAL_VISIT / MEDS)
                const upcomingTimeline = timelineItems
                    .filter(item => !item.isDeleted && SHOWN_TYPES.has(item.type) && item.date >= today)
                    .sort((a, b) => toSortKey(a).localeCompare(toSortKey(b))) as UpcomingActivityType[];

                // Filter out timeline items earlier today
                const upcomingFutureTimeline = upcomingTimeline.filter(item => {
                    const time = item.type === "HANDOVER" ? (item as HandoverItem).time : "00:00";
                    return item.date > today || time >= currentTime;
                });

                // 2. Detect next custody-schedule handover
                const custodyHandover = findNextCustodyHandover(custodyEntries, today, currentTime);

                // 3. Pick whichever comes first
                let best: UpcomingActivityType | null = upcomingFutureTimeline[0] ?? null;

                if (custodyHandover) {
                    const custodyKey = toSortKey(custodyHandover);
                    if (!best || custodyKey < toSortKey(best as TimelineItem)) {
                        best = custodyHandover;
                    }
                }

                setNextActivity(best);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load upcoming activity");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();

        return () => { cancelled = true; };
    }, [refreshKey]);

    return { nextActivity, isLoading, error };
}
