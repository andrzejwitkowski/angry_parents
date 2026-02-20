import { describe, expect, it, beforeEach } from "bun:test";
import { GapFillStrategy } from "../GapFillStrategy";
import { CustodyPatternConfig } from "../../CustodyPatternConfig";
import { UuidProvider } from "../../../ports/UuidProvider";

class MockUuidProvider implements UuidProvider {
    generate(): string {
        return "mock-uuid";
    }
}

describe("GapFillStrategy", () => {
    let strategy: GapFillStrategy;
    let uuidProvider: UuidProvider;

    beforeEach(() => {
        strategy = new GapFillStrategy();
        uuidProvider = new MockUuidProvider();
    });

    it("should generate entries for every day in the range", () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2024-01-01",
            endDate: "2024-01-05", // 5 days
            type: "GAP_FILL",
            startingParent: "MOM"
        };

        const result = strategy.generate(config, uuidProvider);

        expect(result).toHaveLength(5);
        expect(result[0].date).toBe("2024-01-01");
        expect(result[4].date).toBe("2024-01-05");
    });

    it("should assign all entries to startingParent", () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2024-01-01",
            endDate: "2024-01-01",
            type: "GAP_FILL",
            startingParent: "DAD"
        };

        const result = strategy.generate(config, uuidProvider);
        expect(result[0].assignedTo).toBe("DAD");
    });

    it("should set priority to -1", () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2024-01-01",
            endDate: "2024-01-01",
            type: "GAP_FILL",
            startingParent: "MOM"
        };

        const result = strategy.generate(config, uuidProvider);
        expect(result[0].priority).toBe(-1);
    });

    it("should mark entries as recurring", () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2024-01-01",
            endDate: "2024-01-01",
            type: "GAP_FILL",
            startingParent: "MOM"
        };

        const result = strategy.generate(config, uuidProvider);
        expect(result[0].isRecurring).toBe(true);
    });
});
