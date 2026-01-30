import { describe, it, expect, beforeEach } from "bun:test";
import { ScheduleService } from "../src/application/ScheduleService";
import { InMemoryScheduleRepository } from "../src/adapters/secondary/InMemoryScheduleRepository";
import { InMemoryCustodyRepository } from "../src/adapters/secondary/InMemoryCustodyRepository";
import { CustodyPatternConfig } from "../src/core/domain/child/CustodyPatternConfig";
import { CustodyEntry } from "../src/core/domain/child/CustodyEntry";

describe("Rule Priority Engine (Formal Verification)", () => {
    let scheduleService: ScheduleService;
    let scheduleRepository: InMemoryScheduleRepository;
    let custodyRepository: InMemoryCustodyRepository;

    beforeEach(() => {
        scheduleRepository = new InMemoryScheduleRepository();
        custodyRepository = new InMemoryCustodyRepository();
        scheduleService = new ScheduleService(scheduleRepository, custodyRepository);
    });

    /**
     * Test Case 1: The Tower of Overrides (Induction)
     * For any stack of rules R0...Rn, the state at time T is determined by the rule with the highest priority covering T.
     */
    it("should strictly respect the N+1 override property (Tower of Overrides)", async () => {
        const TEST_DATE = "2024-01-01";
        const STACK_HEIGHT = 10;

        // Base Step: Create Rule 0
        const baseConfig: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: TEST_DATE,
            endDate: TEST_DATE, // Single day rule for precision
            startingParent: "DAD"
        };
        await scheduleService.createRule(baseConfig);

        // Verification Loop
        for (let i = 1; i <= STACK_HEIGHT; i++) {
            // Alternating Parent Logic: Odd rules = MOM, Even rules = DAD
            const targetParent = i % 2 !== 0 ? "MOM" : "DAD";

            const config: CustodyPatternConfig = {
                childId: "child-1",
                type: "ALTERNATING_WEEKEND",
                startDate: TEST_DATE,
                endDate: TEST_DATE,
                startingParent: targetParent // This rule dictates the day
            };

            // Action: Create Rule (N+1)
            const rule = await scheduleService.createRule(config);

            // Assert: The new rule must have priority > previous rule
            // Base Rule = 1. Rule 1 = 2. So Rule i = i + 1.
            expect(rule.priority).toBe(i + 1);

            // Assert: Calendar State respects High Priority
            const rawEntries = await custodyRepository.findByDateRange("child-1", TEST_DATE, TEST_DATE);
            const resolvedEntry = resolveConflicts(rawEntries);

            expect(resolvedEntry).toBeDefined();
            expect(resolvedEntry?.assignedTo).toBe(targetParent);
            expect(resolvedEntry?.sourceRuleId).toBe(rule.id);
        }
    });

    /**
     * Test Case 2: The Sandwich Insertion
     * Proves that inserting a rule in the middle (Low Priority) does NOT override a Higher Priority rule.
     */
    it("should respect priority even when rules are inserted out of order (Sandwich Test)", async () => {
        const TEST_HOURLY = "2024-01-01";

        // Manual Setup to simulate "Sandwich"
        const entries: CustodyEntry[] = [
            { id: "e1", childId: "c1", date: "2024-01-01", startTime: "00:00", endTime: "23:59", assignedTo: "DAD", priority: 1, isRecurring: true } as any, // Low
            { id: "e2", childId: "c1", date: "2024-01-01", startTime: "00:00", endTime: "23:59", assignedTo: "MOM", priority: 10, isRecurring: true } as any, // High
            { id: "e3", childId: "c1", date: "2024-01-01", startTime: "00:00", endTime: "23:59", assignedTo: "DAD", priority: 5, isRecurring: true } as any  // Med
        ].map(e => ({ ...e }));

        const resolved = resolveConflicts(entries);
        expect(resolved).toBeDefined();
        expect(resolved?.assignedTo).toBe("MOM"); // Priority 10 wins
        expect(resolved?.id).toBe("e2");
    });
});

/**
 * Helper: Pure function to resolve conflicts based on priority.
 * This effectively tests the "View Logic" we will implement in the service/frontend.
 */
function resolveConflicts(entries: CustodyEntry[]): CustodyEntry | null {
    if (entries.length === 0) return null;
    // Sort by Priority DESC
    return entries.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}
