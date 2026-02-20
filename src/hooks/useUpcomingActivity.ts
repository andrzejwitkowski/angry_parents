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

/**
 * Detect upcoming custody handovers by finding the first day this week where
 * the assigned parent changes from the previous day — that boundary IS a handover.
 * Returns a synthetic HandoverItem if one is found.
 */
function findNextCustodyHandover(
    entries: CustodyEntry[],
    today: string,
    weekEnd: string
): HandoverItem | null {
    // Only care about entries in today..weekEnd range
    const inRange = [...entries]
        .filter(e => e.date >= today && e.date <= weekEnd)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (inRange.length === 0) return null;

    // Also need yesterday's state to detect a transition happening today
    const allSorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // Build a date→assignedTo map (highest priority wins per day)
    const dayMap = new Map<string, { assignedTo: "MOM" | "DAD"; time: string }>();
    for (const e of allSorted) {
        const existing = dayMap.get(e.date);
        if (!existing || e.priority > (entries.find(x => x.date === e.date)?.priority ?? 0)) {
            dayMap.set(e.date, { assignedTo: e.assignedTo, time: e.startTime });
        }
    }

    // Walk forward from yesterday to find the first transition
    const yesterday = format(subDays(new Date(today), 1), "yyyy-MM-dd");
    let prevParent = dayMap.get(yesterday)?.assignedTo ?? null;

    for (const entry of inRange) {
        const cur = dayMap.get(entry.date);
        if (!cur) continue;

        // A handover occurs when:
        //  (a) prevParent is null — today has no custody block, so the upcoming block is a transition
        //  (b) parent flips from one day to next
        if (cur.assignedTo !== prevParent) {
            const handoverTime = cur.time && cur.time !== "00:00" ? cur.time : "17:00";
            return {
                id: `custody-handover-${entry.date}`,
                type: "HANDOVER",
                date: entry.date,
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

            const today = format(new Date(), "yyyy-MM-dd");
            const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

            try {
                // Fetch both in parallel
                const [timelineItems, custodyEntries] = await Promise.all([
                    timelineApi.getByDateRange(today, weekEnd),
                    fetch(`http://localhost:3000/api/custody?start=${today}&end=${weekEnd}`)
                        .then(r => r.ok ? r.json() as Promise<CustodyEntry[]> : Promise.resolve([] as CustodyEntry[]))
                        .catch(() => [] as CustodyEntry[])
                ]);

                if (cancelled) return;

                // 1. Upcoming timeline activities (HANDOVER / MEDICAL_VISIT / MEDS)
                const upcomingTimeline = timelineItems
                    .filter(item => !item.isDeleted && SHOWN_TYPES.has(item.type) && item.date >= today)
                    .sort((a, b) => toSortKey(a).localeCompare(toSortKey(b))) as UpcomingActivityType[];

                // 2. Detect next custody-schedule handover
                const custodyHandover = findNextCustodyHandover(custodyEntries, today, weekEnd);

                // 3. Pick whichever comes first
                let best: UpcomingActivityType | null = upcomingTimeline[0] ?? null;

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
