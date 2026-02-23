import { describe, it, expect } from "vitest";
import { CustodyGenerator } from "../src/application/CustodyGenerator";
import { CustodyPatternConfig } from "../src/core/domain/child/CustodyPatternConfig";
import { CustodyEntry } from "../src/core/domain/child/CustodyEntry";
import { ConflictService } from "../src/core/domain/child/ConflictService";
import { RealUuidProvider } from "../src/adapters/secondary/RealUuidProvider";

describe("CustodyGenerator", () => {
    const generator = new CustodyGenerator(new RealUuidProvider());

    // Helper to find entries by date
    const getEntriesForDate = (entries: CustodyEntry[], date: string) =>
        entries.filter(e => e.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));

    it("Case 1: The 'Friday Handover' (Split Day)", () => {
        // Config: Alternating Weekend, Handover 17:00, Handover End 19:00, Start Date: Friday 2026-01-30
        // Friday 2026-01-30 is a Friday.
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-01-30",
            endDate: "2026-02-02", // Fri to Mon
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD", // Parent B (Weekend Owner)
            handoverTime: "17:00",
            handoverEndTime: "19:00"
        };

        const entries = generator.generate(config);

        // Expect: Friday 2026-01-30 should have 2 entries
        const fridayEntries = getEntriesForDate(entries, "2026-01-30");
        expect(fridayEntries).toHaveLength(2);

        // 00:00 - 17:00 Parent A (MOM)
        expect(fridayEntries[0].assignedTo).toBe("MOM");
        expect(fridayEntries[0].startTime).toBe("00:00");
        expect(fridayEntries[0].endTime).toBe("17:00");

        // 17:00 - 23:59 Parent B (DAD) - New Custody starts
        expect(fridayEntries[1].assignedTo).toBe("DAD");
        expect(fridayEntries[1].startTime).toBe("17:00");
        expect(fridayEntries[1].endTime).toBe("23:59");

        // Saturday 2026-01-31
        const saturdayEntries = getEntriesForDate(entries, "2026-01-31");
        expect(saturdayEntries).toHaveLength(1);
        expect(saturdayEntries[0].assignedTo).toBe("DAD");

        // Sunday 2026-02-01: 2 entries (00:00-19:00 Parent B, 19:00-23:59 Parent A)
        const sundayEntries = getEntriesForDate(entries, "2026-02-01");
        expect(sundayEntries).toHaveLength(2);

        expect(sundayEntries[0].assignedTo).toBe("DAD");
        expect(sundayEntries[0].startTime).toBe("00:00");
        expect(sundayEntries[0].endTime).toBe("19:00");

        expect(sundayEntries[1].assignedTo).toBe("MOM");
        expect(sundayEntries[1].startTime).toBe("19:00");
        expect(sundayEntries[1].endTime).toBe("23:59");

        // Monday (Return): 1 entry for MOM
        const mondayEntries = getEntriesForDate(entries, "2026-02-02");
        expect(mondayEntries).toHaveLength(1);
        expect(mondayEntries[0].assignedTo).toBe("MOM");
    });

    it("Case 2: The 'Custom Block' Rotation", () => {
        // Config: Custom Block of 2 days, repeating every 14 days (2 weeks). Start Monday 2026-02-02. Parent A (MOM).
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-02-02", // Monday
            endDate: "2026-02-28", // Full month
            type: "CUSTOM_BLOCK",
            startingParent: "MOM",
            handoverTime: "09:00",
            customBlockRepeatInterval: 2,
            customBlockRepeatUnit: "WEEKS",
            customBlockEndDayOffset: 2, // 2 days duration
            anchorDate: "2026-02-02"
        };

        const entries = generator.generate(config);

        // Mon 02 (Day 0) - MOM
        const mon1 = getEntriesForDate(entries, "2026-02-02");
        expect(mon1.length).toBeGreaterThan(0);
        expect(mon1.some(e => e.assignedTo === "MOM")).toBe(true);

        // Wed 04 (Day 2) - DAD (Parent B) block ends here!
        const wed1 = getEntriesForDate(entries, "2026-02-04");
        expect(wed1.length).toBeGreaterThan(0);
        expect(wed1.some(e => e.assignedTo === "DAD")).toBe(true);

        // Next repeat is 2026-02-16 (14 days later)
        const mon3 = getEntriesForDate(entries, "2026-02-16");
        expect(mon3.length).toBeGreaterThan(0);
        expect(mon3.some(e => e.assignedTo === "MOM")).toBe(true);
    });

    it("Case 6: Every Other Tuesday ([1, 13] Pattern)", () => {
        // Start Date: Tuesday 2026-03-03.
        // Sequence: 1 day ON (Tue), 13 days OFF (Wed-Mon next week).
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-03-03", // Tuesday
            endDate: "2026-03-31",
            type: "CUSTOM_SEQUENCE",
            sequence: [1, 13],
            startingParent: "MOM"
        };

        const entries = generator.generate(config);

        // Tue Mar 03: MOM (Day 0 of Cycle)
        const day1 = getEntriesForDate(entries, "2026-03-03");
        expect(day1[0].assignedTo).toBe("MOM");

        // Wed Mar 04: DAD (Day 1 of Cycle - Start of 13 block)
        const day2 = getEntriesForDate(entries, "2026-03-04");
        expect(day2[0].assignedTo).toBe("DAD");

        // Tue Mar 17 (2 weeks later): MOM (New Cycle Day 0/14)
        const day15 = getEntriesForDate(entries, "2026-03-17");
        expect(day15[0].assignedTo).toBe("MOM");

        // Wed Mar 18: DAD
        const day16 = getEntriesForDate(entries, "2026-03-18");
        expect(day16[0].assignedTo).toBe("DAD");
    });

    it("Case 3: Holiday Override (Priority)", () => {
        // Setup: Generate "Dad every weekend" (Priority 0).
        // Action: Generate "Mom on Christmas (Dec 25)" (Priority 10). Assume Dec 25 is a Saturday.
        // 2027-12-25 is a Saturday.

        // Step 1: Generate Standard Weekend Entry for Dad
        /* const weekendConfig: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2027-12-01",
            endDate: "2027-12-31",
            type: "WEEKEND",
            startingParent: "DAD"
        }; */

        // We assume generator allows merging/overwriting. 
        // In a real app, we might call generate twice and merge.
        // Or providing a list of holidays in the config.
        // The Prompt says: "Holidays? : string[]" in config.
        // So we pass the holiday list in the same config OR we generate two sets and merge.
        // "Conflict Resolution... When saving entries... If New.priority > Existing.priority -> Overwrite"
        // This implies we generate entries separately and then save/merge.
        // For the UNIT TEST of the GENERATOR, we can test that the generator CAN produce high priority entries
        // AND that we have a utility to merge them. 
        // OR the generator takes exclusion dates.
        // Let's assume we simulate the "Conflict Resolution" logic here or in the generator.
        // Let's test that we can generate the Holiday entry with Priority 10.

        const holidayConfig: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2027-12-25",
            endDate: "2027-12-25",
            type: "HOLIDAY",
            startingParent: "MOM",
            holidays: ["2027-12-25"]
        };

        const holidayEntries = generator.generate(holidayConfig);
        const xmas = getEntriesForDate(holidayEntries, "2027-12-25")[0];

        expect(xmas.priority).toBe(10);
        expect(xmas.assignedTo).toBe("MOM");

        // We should also test the MERGE logic if it's part of the generator or service.
        // Prompt says: "When saving entries... Conflict Resolution". 
        // So the generator might just spit out entries, and a Service handles saving/merging.
        // BUT "Backend Logic: Implement ... Conflict Resolution (Overlap & Priority)". 
        // Let's add a test for a `resolveConflicts(existing, new)` method if we put it in Generator, 
        // or just assume we test the output properties correctly for now.
    });

    it("Case 4: The 'Sandwich' Day (3 splits)", () => {
        // Scenario: Dad picks up kid from school (14:00) and drops off evening (20:00).
        // Base: Mom has day (00-24).
        // Overlay: Dad has 14:00-20:00.
        // Result: Mom 00-14, Dad 14-20, Mom 20-24.

        // Result: Mom 00-14, Dad 14-20, Mom 20-24.

        const momEntry: CustodyEntry = {
            id: "1", childId: "c1", date: "2026-05-20", startTime: "00:00", endTime: "23:59",
            assignedTo: "MOM", isRecurring: true, priority: 0
        };

        const dadEntry: CustodyEntry = {
            id: "2", childId: "c1", date: "2026-05-20", startTime: "14:00", endTime: "20:00",
            assignedTo: "DAD", isRecurring: false, priority: 1 // Higher priority
        };

        // We use the ConflictService (assuming it's available or we skip if strictly unit testing Generator)
        // But the Prompt mandated "Conflict Resolution" logic.
        // Importing here via relative path
        const conflictService = new ConflictService(new RealUuidProvider());
        const resolved = conflictService.resolve([momEntry, dadEntry]);

        expect(resolved).toHaveLength(3);

        // 1. Mom 00:00 - 14:00
        expect(resolved[0].assignedTo).toBe("MOM");
        expect(resolved[0].startTime).toBe("00:00");
        expect(resolved[0].endTime).toBe("14:00");

        // 2. Dad 14:00 - 20:00
        expect(resolved[1].assignedTo).toBe("DAD");
        expect(resolved[1].startTime).toBe("14:00");
        expect(resolved[1].endTime).toBe("20:00");

        // 3. Mom 20:00 - 23:59
        expect(resolved[2].assignedTo).toBe("MOM");
        expect(resolved[2].startTime).toBe("20:00");
        expect(resolved[2].endTime).toBe("23:59");
    });

    it("Case 5: Month/Year Boundaries", () => {
        // Config: Alternating Weekend starting Dec 31st.
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-12-31", // Thursday
            endDate: "2027-01-04",
            type: "ALTERNATING_WEEKEND", // Handover usually Friday?
            startingParent: "DAD",
            handoverTime: "17:00"
        };

        const entries = generator.generate(config);
        // Just verify we have entries for both years
        const dec31 = getEntriesForDate(entries, "2026-12-31");
        const jan01 = getEntriesForDate(entries, "2027-01-01");

        expect(dec31.length).toBeGreaterThan(0);
        expect(jan01.length).toBeGreaterThan(0);
    });
    it("Case 7: Regression - Monday Start with Handover Time (User Bug Report)", () => {
        // User Start: 05.01 (Monday). Handover 17:05, Handover End 08:00
        // Expectation: Monday reflects morning return at 08:00

        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-01-05", // Monday
            endDate: "2026-01-05", // Just checking Monday
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD",
            handoverTime: "17:05", // Specific time
            handoverEndTime: "08:00" // Morning return
        };

        const entries = generator.generate(config);
        const mondayEntries = getEntriesForDate(entries, "2026-01-05");

        expect(mondayEntries).toHaveLength(2);

        // Entry 1: DAD (Weekend Parent returning child Monday morning)
        expect(mondayEntries[0].assignedTo).toBe("DAD");
        expect(mondayEntries[0].startTime).toBe("00:00");
        expect(mondayEntries[0].endTime).toBe("08:00");

        // Entry 2: MOM (Weekday Parent taking over)
        expect(mondayEntries[1].assignedTo).toBe("MOM");
        expect(mondayEntries[1].startTime).toBe("08:00");
        expect(mondayEntries[1].endTime).toBe("23:59");
    });

    it("Case 8: Daylight Saving Time (DST) Math Bug", () => {
        // DST transition in Europe: March 29, 2026 (clocks go forward).
        // If we calculate day differences using raw milliseconds and Math.floor/ceil,
        // days after Mar 29 will be off by 1 hour (e.g. 13.95 days instead of 14 days),
        // breaking the week rotation math (14-day modulo).
        const config: CustodyPatternConfig = {
            childId: "child-1",
            startDate: "2026-03-13", // Friday (Week 1 for DAD)
            endDate: "2026-04-12",   // Spans across DST
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD",
            handoverTime: "17:00",
            handoverEndTime: "19:00"
        };

        const entries = generator.generate(config);

        // March 27-29 is Week 3 (Same phase as Week 1). DAD has the weekend.
        // DST switch happens on Sunday Mar 29 morning.
        const mar27 = getEntriesForDate(entries, "2026-03-27");
        expect(mar27.some(e => e.assignedTo === "DAD" && e.startTime === "17:00")).toBe(true);

        // April 10-12 is Week 5 (Same phase as Week 1). DAD should STILL have the weekend.
        // If the timezone bug exists, this might shift and DAD would be missing.
        const apr10 = getEntriesForDate(entries, "2026-04-10");
        expect(apr10.some(e => e.assignedTo === "DAD" && e.startTime === "17:00")).toBe(true);
    });
});
