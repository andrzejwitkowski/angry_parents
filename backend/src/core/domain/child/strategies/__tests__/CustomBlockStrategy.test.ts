import { expect, test, describe } from "bun:test";
import { CustomBlockStrategy } from "../CustomBlockStrategy";
import { CustodyPatternConfig } from "../../CustodyPatternConfig";
import { UuidProvider } from "../../../../ports/UuidProvider";

class MockUuidProvider implements UuidProvider {
    private counter = 0;
    generate(): string {
        return `mock-uuid-${++this.counter}`;
    }
}

describe("CustomBlockStrategy", () => {
    test("generates basic custom block without customBlockStartDay", () => {
        const strategy = new CustomBlockStrategy();
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-02-01", // Sunday
            endDate: "2026-02-04",
            type: "CUSTOM_BLOCK",
            startingParent: "MOM",
            customBlockRepeatInterval: 1,
            customBlockRepeatUnit: "WEEKS",
            customBlockEndDayOffset: 1, // Ends Mon
            anchorDate: "2026-02-01"
        };
        const uuidProvider = new MockUuidProvider();

        const entries = strategy.generate(config, uuidProvider);

        // Expectation:
        // Sunday (0): MOM 00:00 -> 23:59
        // Monday (1): MOM 00:00 -> 09:00, DAD 09:00 -> 23:59
        // Tuesday (2): DAD 00:00 -> 23:59
        // Wednesday (3): DAD 00:00 -> 23:59

        expect(entries.length).toBe(6); // Each split day needs 2 entries (except purely 1 parent)
    });

    test("generates custom block with customBlockStartDay", () => {
        const strategy = new CustomBlockStrategy();
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-02-01", // Sunday
            endDate: "2026-02-05", // Thursday
            type: "CUSTOM_BLOCK",
            startingParent: "MOM",
            handoverTime: "17:00",
            handoverEndTime: "09:00",
            customBlockRepeatInterval: 1,
            customBlockRepeatUnit: "WEEKS",
            customBlockEndDayOffset: 1, // Ends 1 day after start day
            customBlockStartDay: 2, // Tuesday
            anchorDate: "2026-02-01" // Sunday
        };
        const uuidProvider = new MockUuidProvider();

        const entries = strategy.generate(config, uuidProvider);

        // Expectation: 
        // 2026-02-01 (Sun): DAD 00:00 -> 23:59
        // 2026-02-02 (Mon): DAD 00:00 -> 23:59
        // 2026-02-03 (Tue): DAD 00:00 -> 17:00, MOM 17:00 -> 23:59
        // 2026-02-04 (Wed): MOM 00:00 -> 09:00, DAD 09:00 -> 23:59
        // 2026-02-05 (Thu): DAD 00:00 -> 23:59

        // Let's find Tuesday's MOM entry
        const tueMom = entries.find(e => e.date === "2026-02-03" && e.assignedTo === "MOM");
        expect(tueMom).toBeDefined();
        expect(tueMom?.startTime).toBe("17:00");
        expect(tueMom?.endTime).toBe("23:59");

        // Let's find Wednesday's MOM entry
        const wedMom = entries.find(e => e.date === "2026-02-04" && e.assignedTo === "MOM");
        expect(wedMom).toBeDefined();
        expect(wedMom?.startTime).toBe("00:00");
        expect(wedMom?.endTime).toBe("09:00");
    });

    test("biweekly Tuesday block — Feb 2026 — correct Tue+Wed pattern", () => {
        // Replicates user scenario:
        // Pattern: Custom Block, 1 day + 1 day end offset (Tue → Wed),
        // repeat every 2 weeks, DAD starts, 17:00 / 19:00 handover
        const strategy = new CustomBlockStrategy();
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-02-01", // Sunday anchor
            endDate: "2026-02-28",
            type: "CUSTOM_BLOCK",
            startingParent: "DAD",
            handoverTime: "17:00",
            handoverEndTime: "19:00",
            customBlockRepeatInterval: 2,
            customBlockRepeatUnit: "WEEKS",
            customBlockEndDayOffset: 1, // block spans Tue (start) + Wed (end)
            customBlockStartDay: 2,     // Tuesday
            anchorDate: "2026-02-01"    // Sunday (day 0)
        };
        const uuidProvider = new MockUuidProvider();
        const entries = strategy.generate(config, uuidProvider);

        // -- Feb 3 (Tuesday): block start day --
        // DAD gets 17:00–23:59, MOM gets 00:00–17:00
        const tueFeb3Dad = entries.find(e => e.date === "2026-02-03" && e.assignedTo === "DAD");
        expect(tueFeb3Dad).toBeDefined();
        expect(tueFeb3Dad?.startTime).toBe("17:00");
        expect(tueFeb3Dad?.endTime).toBe("23:59");

        const tueFeb3Mom = entries.find(e => e.date === "2026-02-03" && e.assignedTo === "MOM");
        expect(tueFeb3Mom).toBeDefined();
        expect(tueFeb3Mom?.startTime).toBe("00:00");
        expect(tueFeb3Mom?.endTime).toBe("17:00");

        // -- Feb 4 (Wednesday): block end day --
        // DAD gets 00:00–19:00, MOM gets 19:00–23:59
        const wedFeb4Dad = entries.find(e => e.date === "2026-02-04" && e.assignedTo === "DAD");
        expect(wedFeb4Dad).toBeDefined();
        expect(wedFeb4Dad?.startTime).toBe("00:00");
        expect(wedFeb4Dad?.endTime).toBe("19:00");

        const wedFeb4Mom = entries.find(e => e.date === "2026-02-04" && e.assignedTo === "MOM");
        expect(wedFeb4Mom).toBeDefined();
        expect(wedFeb4Mom?.startTime).toBe("19:00");
        expect(wedFeb4Mom?.endTime).toBe("23:59");

        // -- Feb 5 (Thursday): outside block — MOM full day only --
        const thuFeb5Dad = entries.find(e => e.date === "2026-02-05" && e.assignedTo === "DAD");
        expect(thuFeb5Dad).toBeUndefined();
        const thuFeb5Mom = entries.find(e => e.date === "2026-02-05" && e.assignedTo === "MOM");
        expect(thuFeb5Mom).toBeDefined();
        expect(thuFeb5Mom?.startTime).toBe("00:00");
        expect(thuFeb5Mom?.endTime).toBe("23:59");

        // -- Feb 17 (Tuesday, 2 weeks later): same block-start pattern --
        const tueFeb17Dad = entries.find(e => e.date === "2026-02-17" && e.assignedTo === "DAD");
        expect(tueFeb17Dad).toBeDefined();
        expect(tueFeb17Dad?.startTime).toBe("17:00");
        expect(tueFeb17Dad?.endTime).toBe("23:59");

        // -- Feb 18 (Wednesday): same block-end pattern --
        const wedFeb18Dad = entries.find(e => e.date === "2026-02-18" && e.assignedTo === "DAD");
        expect(wedFeb18Dad).toBeDefined();
        expect(wedFeb18Dad?.startTime).toBe("00:00");
        expect(wedFeb18Dad?.endTime).toBe("19:00");

        // -- Feb 10 (Monday, off-week): entirely MOM --
        const monFeb10Dad = entries.find(e => e.date === "2026-02-10" && e.assignedTo === "DAD");
        expect(monFeb10Dad).toBeUndefined();
    });
});
