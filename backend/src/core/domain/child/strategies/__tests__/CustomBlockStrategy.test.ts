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
});
