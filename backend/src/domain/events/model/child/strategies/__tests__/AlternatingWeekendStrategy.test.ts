import { expect, test, describe } from "bun:test";
import { AlternatingWeekendStrategy } from "../AlternatingWeekendStrategy";
import { CustodyPatternConfig } from "../../CustodyPatternConfig";
import { UuidProvider } from "../../../../../shared/ports/UuidProvider";

class MockUuidProvider implements UuidProvider {
    private counter = 0;
    generate(): string {
        return `mock-uuid-${++this.counter}`;
    }
}

const makeConfig = (overrides: Partial<CustodyPatternConfig> = {}): CustodyPatternConfig => ({
    childId: "child-1",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    type: "ALTERNATING_WEEKEND",
    startingParent: "DAD",
    handoverTime: "17:00",
    handoverEndTime: "19:00",
    anchorDate: "2026-02-01", // Sunday
    ...overrides,
});

describe("AlternatingWeekendStrategy", () => {
    const strategy = new AlternatingWeekendStrategy();

    test("anchor=Sunday: Feb 1 is DAD (On-Sunday return part)", () => {
        // With anchor=Sunday(Feb 1), the week of Feb 1 is the 'on' week (Jan 30 - Feb 5).
        // Feb 1 (Sun) is relToFriday = 2.
        const entries = strategy.generate(makeConfig(), new MockUuidProvider());

        const feb1 = entries.filter(e => e.date === "2026-02-01");
        // Feb 1 is Sunday. handoverEndTime=19:00 -> returnOnSunday=true.
        // DAD has 00:00 to 19:00, MOM has 19:00 to 23:59.
        expect(feb1.find(e => e.assignedTo === "DAD" && e.startTime === "00:00")?.endTime).toBe("19:00");
    });

    test("anchor=Sunday: Feb 6-8 is the OFF weekend — all MOM (weekday parent)", () => {
        const entries = strategy.generate(makeConfig(), new MockUuidProvider());

        ["2026-02-06", "2026-02-07", "2026-02-08"].forEach(date => {
            const dayEntries = entries.filter(e => e.date === date);
            expect(dayEntries.every(e => e.assignedTo === "MOM")).toBe(true);
        });
    });

    test("anchor=Sunday: Feb 13 (Fri) is the next DAD handover (on week 3)", () => {
        const entries = strategy.generate(makeConfig(), new MockUuidProvider());

        const fri13 = entries.filter(e => e.date === "2026-02-13");
        const dadPart = fri13.find(e => e.assignedTo === "DAD");
        expect(dadPart).toBeDefined();
        expect(dadPart?.startTime).toBe("17:00");
    });

    test("anchor=Friday: first Friday is the on-weekend day (no offset)", () => {
        // When anchor is already a Friday, fridayOffset=0: cycleDay=0 → Fri immediately.
        const config = makeConfig({
            startDate: "2026-02-06", // Friday
            endDate: "2026-02-08",
            anchorDate: "2026-02-06",
        });
        const entries = strategy.generate(config, new MockUuidProvider());

        const fri = entries.filter(e => e.date === "2026-02-06");
        expect(fri.some(e => e.assignedTo === "DAD" && e.startTime === "17:00")).toBe(true);

        const sat = entries.filter(e => e.date === "2026-02-07");
        expect(sat[0].assignedTo).toBe("DAD");

        const sun = entries.filter(e => e.date === "2026-02-08");
        expect(sun.some(e => e.assignedTo === "DAD" && e.endTime === "19:00")).toBe(true);
    });

    test("returnOnMonday: anchor=Sunday, Sun stays, Mon is return day", () => {
        // anchor=Sunday(Feb 1) -> Feb 8 is Sunday index 9 (Off).
        // To test returnOnMonday we need a Sunday index 2.
        // Let's anchor at Feb 15 (Sunday) which is index 2 in the cycle.
        const config = makeConfig({ anchorDate: "2026-02-15", handoverEndTime: "09:00" });
        const entries = strategy.generate(config, new MockUuidProvider());

        // Feb 15 (Sun) should be full-day DAD (child stays over)
        const sun = entries.filter(e => e.date === "2026-02-15");
        expect(sun.length).toBe(1);
        expect(sun[0].assignedTo).toBe("DAD");

        // Feb 16 (Mon) should be split DAD→MOM at 09:00
        const mon = entries.filter(e => e.date === "2026-02-16");
        const dadPart = mon.find(e => e.assignedTo === "DAD");
        expect(dadPart).toBeDefined();
        expect(dadPart?.endTime).toBe("09:00");
    });
});
