import { describe, it, expect, beforeEach } from "bun:test";
import { ScheduleService } from "../src/domain/events/service/ScheduleService";
import { InMemoryScheduleRepository } from "../src/adapters/mongo/inmemory/events/InMemoryScheduleRepository";
import { InMemoryCustodyRepository } from "../src/adapters/mongo/inmemory/events/InMemoryCustodyRepository";
import { CustodyPatternConfig } from "../src/domain/events/model/child/CustodyPatternConfig";
import { CustodyEntry } from "../src/domain/events/model/child/CustodyEntry";
import { RealDateProvider } from "../src/shared/providers/RealDateProvider";
import { RealUuidProvider } from "../src/shared/providers/RealUuidProvider";

describe("ScheduleService", () => {
    let scheduleService: ScheduleService;
    let scheduleRepository: InMemoryScheduleRepository;
    let custodyRepository: InMemoryCustodyRepository;

    beforeEach(() => {
        scheduleRepository = new InMemoryScheduleRepository();
        custodyRepository = new InMemoryCustodyRepository();
        scheduleService = new ScheduleService(scheduleRepository, custodyRepository, new RealDateProvider(), new RealUuidProvider());
    });

    it("should create a rule and generate tagged entries", async () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: "2024-01-01",
            endDate: "2024-01-14",
            startingParent: "DAD",
            holidays: []
        };

        const rule = await scheduleService.createRule(config);

        expect(rule).toBeDefined();
        expect(rule.childId).toBe("child-1");
        expect(rule.id).toContain("rule-");

        const entries = await custodyRepository.findByDateRange("child-1", "2024-01-01", "2024-01-14");
        expect(entries.length).toBeGreaterThan(0);

        // Verify all entries have the correct sourceRuleId
        entries.forEach(entry => {
            expect(entry.sourceRuleId).toBe(rule.id);
        });
    });

    it("should cascade delete entries when rule is deleted", async () => {
        const config: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: "2024-01-01",
            endDate: "2024-01-14",
            startingParent: "DAD",
            holidays: []
        };

        // 1. Create Rule
        const rule = await scheduleService.createRule(config);
        const ruleId = rule.id;

        // Verify entries exist
        let entries = await custodyRepository.findByDateRange("child-1", "2024-01-01", "2024-01-14");
        expect(entries.length).toBeGreaterThan(0);

        // 2. Delete Rule
        await scheduleService.deleteRule(ruleId);

        // 3. Verify Rule is gone
        const deletedRule = await scheduleRepository.findById(ruleId);
        expect(deletedRule).toBeNull();

        // 4. Verify Entries are gone
        entries = await custodyRepository.findByDateRange("child-1", "2024-01-01", "2024-01-14");
        expect(entries.length).toBe(0);
    });

    it("should NOT delete manual entries when deleting a rule", async () => {
        // 1. Create Manual Entry
        const manualEntry: CustodyEntry = {
            id: "manual-1",
            childId: "child-1",
            date: "2024-01-01",
            startTime: "09:00",
            endTime: "17:00",
            assignedTo: "MOM",
            isRecurring: false,
            priority: 1
            // No sourceRuleId
        };
        await custodyRepository.save([manualEntry]);

        // 2. Create Rule which generates its own entries
        const config: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: "2024-01-02",
            endDate: "2024-01-14",
            startingParent: "DAD",
            holidays: []
        };
        const rule = await scheduleService.createRule(config);

        // 3. Delete Rule
        await scheduleService.deleteRule(rule.id);

        // 4. Verify Manual Entry Remains
        const remainingEntries = await custodyRepository.findByDateRange("child-1", "2024-01-01", "2024-01-14");
        expect(remainingEntries.length).toBe(1);
        expect(remainingEntries[0].id).toBe("manual-1");
    });

    it("should allow multiple rules to coexist and generate distinct entries", async () => {
        // Rule 1: Jan 1-14 (Dad)
        const config1: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: "2024-01-01",
            endDate: "2024-01-14",
            startingParent: "DAD"
        };
        const rule1 = await scheduleService.createRule(config1);

        // Rule 2: Feb 1-14 (Mom)
        const config2: CustodyPatternConfig = {
            childId: "child-1",
            type: "ALTERNATING_WEEKEND",
            startDate: "2024-02-01",
            endDate: "2024-02-14",
            startingParent: "MOM"
        };
        const rule2 = await scheduleService.createRule(config2);

        // Verify Rule 1 Entries
        const entries1 = await custodyRepository.findByDateRange("child-1", "2024-01-01", "2024-01-14");
        expect(entries1.length).toBeGreaterThan(0);
        expect(entries1[0].sourceRuleId).toBe(rule1.id);
        // Jan 3, 2024 is Wednesday. DAD is weekendParent, MOM is weekdayParent (full day Wednesday).
        expect(entries1.find(e => e.date === "2024-01-03")?.assignedTo).toBe("MOM");

        // Verify Rule 2 Entries
        const entries2 = await custodyRepository.findByDateRange("child-1", "2024-02-01", "2024-02-14");
        expect(entries2.length).toBeGreaterThan(0);
        expect(entries2[0].sourceRuleId).toBe(rule2.id);
        // Mom is startingParent (weekendParent). 
        // Rule starts Feb 1 (Thu). Preceding Fri is Jan 26. 
        // So Jan 26-Feb 1 is the 'On' week. Feb 2-8 is 'Off'. Feb 9-15 is 'On'.
        // Check Feb 10 (Saturday of the second 'On' weekend)
        expect(entries2.find(e => e.date === "2024-02-10")?.assignedTo).toBe("MOM");
    });
});
