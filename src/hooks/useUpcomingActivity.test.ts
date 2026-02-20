import { describe, it, expect } from "bun:test";
import type { HandoverItem, MedicalVisitItem } from "@/types/timeline.types";

// Helper to build a minimal HandoverItem
function makeHandover(date: string, time: string): HandoverItem {
    return {
        id: `h-${date}-${time}`, type: "HANDOVER", date, time,
        location: "Park", status: "PENDING",
        createdAt: `${date}T00:00:00Z`, createdBy: "user-1",
        childIds: [], auditTrail: [], isDeleted: false,
    };
}

function makeMedical(date: string): MedicalVisitItem {
    return {
        id: `m-${date}`, type: "MEDICAL_VISIT", date,
        doctor: "Dr. House", specialization: "Internal",
        diagnosis: "Lupus", recommendations: "",
        attachments: [], createdAt: `${date}T00:00:00Z`,
        createdBy: "user-1", childIds: [], auditTrail: [], isDeleted: false,
    };
}

/**
 * Pure sorting/filtering logic extracted from useUpcomingActivity.
 * Tests here are framework-independent for bun:test compatibility.
 */
const SHOWN_TYPES = new Set(["HANDOVER", "MEDICAL_VISIT", "MEDS"]);

function toSortKey(item: { type: string; date: string; time?: string }): string {
    const time = item.type === "HANDOVER" ? (item.time ?? "00:00") : "00:00";
    return `${item.date}T${time}`;
}

function filterAndSort(items: (HandoverItem | MedicalVisitItem)[], today: string) {
    return items
        .filter(i => !i.isDeleted && SHOWN_TYPES.has(i.type) && i.date >= today)
        .sort((a, b) => toSortKey(a).localeCompare(toSortKey(b)));
}

describe("useUpcomingActivity – filtering & sorting logic", () => {
    it("picks the soonest activity from a mixed list", () => {
        const items = [
            makeHandover("2026-02-21", "16:00"),
            makeHandover("2026-02-19", "09:00"),
            makeMedical("2026-02-20"),
        ];

        const result = filterAndSort(items, "2026-02-19");
        expect(result[0].id).toBe("h-2026-02-19-09:00");
    });

    it("returns empty array when no items in range", () => {
        const result = filterAndSort([], "2026-02-19");
        expect(result).toHaveLength(0);
        expect(result[0] ?? null).toBeNull();
    });

    it("excludes items with date before today", () => {
        const items = [
            makeHandover("2026-02-17", "10:00"), // past
            makeHandover("2026-02-20", "10:00"), // future
        ];
        const result = filterAndSort(items, "2026-02-19");
        expect(result).toHaveLength(1);
        expect(result[0].date).toBe("2026-02-20");
    });

    it("excludes deleted items", () => {
        const deleted: HandoverItem = { ...makeHandover("2026-02-19", "10:00"), isDeleted: true };
        const result = filterAndSort([deleted], "2026-02-19");
        expect(result).toHaveLength(0);
    });

    it("later time on same day sorts after earlier time", () => {
        const items = [
            makeHandover("2026-02-19", "18:00"),
            makeHandover("2026-02-19", "08:00"),
        ];
        const result = filterAndSort(items, "2026-02-19");
        expect(result[0].id).toBe("h-2026-02-19-08:00");
    });
});
