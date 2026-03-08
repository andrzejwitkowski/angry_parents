import { describe, it, expect } from "vitest";
import { CustodyGenerator } from "../src/domain/events/service/CustodyGenerator";
import { CustodyPatternConfig } from "../src/domain/events/model/child/CustodyPatternConfig";
import { RealUuidProvider } from "../src/shared/providers/RealUuidProvider";

describe("Alternating Weekend Reproduction (Feb 2026)", () => {
    const generator = new CustodyGenerator(new RealUuidProvider());

    it("should generate entries for the SECOND weekend (Feb 20-22) when starting on Feb 6", () => {
        const config: CustodyPatternConfig = {
            childId: "siuska-id",
            startDate: "2026-02-06", // Friday
            endDate: "2026-02-28",
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD",
            anchorDate: "2026-02-06",
            handoverTime: "17:00",
            handoverEndTime: "19:00"
        };

        const entries = generator.generate(config);

        // Feb 6 (Fri) - 1st Weekend START
        const feb6 = entries.filter(e => e.date === "2026-02-06");
        expect(feb6.some(e => e.assignedTo === "DAD")).toBe(true);

        // Feb 13 (Fri) - OFF Weekend
        const feb13 = entries.filter(e => e.date === "2026-02-13");
        expect(feb13.some(e => e.assignedTo === "DAD")).toBe(false);

        // Feb 20 (Fri) - 2nd Weekend START (Day 14)
        const feb20 = entries.filter(e => e.date === "2026-02-20");
        expect(feb20.some(e => e.assignedTo === "DAD")).toBe(true);

        // Feb 22 (Sun) - 2nd Weekend END
        const feb22 = entries.filter(e => e.date === "2026-02-22");
        expect(feb22.some(e => e.assignedTo === "DAD")).toBe(true);
    });
});
