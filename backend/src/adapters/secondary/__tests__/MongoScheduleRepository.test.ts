import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoScheduleRepository } from "../MongoScheduleRepository";
import { ScheduleRuleModel } from "../../../models/ScheduleRule";
import type { ScheduleRule } from "../../../core/domain/child/ScheduleRule";
import { connectMongoMemory, disconnectMongoMemory } from "./mongoMemoryServer";

describe("MongoScheduleRepository", () => {
    let repository: MongoScheduleRepository;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoScheduleRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await ScheduleRuleModel.deleteMany({});
    });

    const mockRule: ScheduleRule = {
        id: "rule-123",
        childId: "child-456",
        name: "Weekend Rule",
        config: {
            type: "WEEKEND",
            details: {
                parent: "DAD"
            }
        },
        priority: 0,
        isOneTime: false,
        createdAt: "2026-03-01T12:00:00Z"
    };

    it("should save and retrieve a rule", async () => {
        await repository.save(mockRule);

        const found = await repository.findById(mockRule.id);
        expect(found).not.toBeNull();
        expect(found?.name).toBe("Weekend Rule");
        // Check config object was saved intact
        expect(found?.config.type).toBe("WEEKEND");
        expect((found?.config.details as any).parent).toBe("DAD");
    });

    it("should return null for non-existent rule", async () => {
        const found = await repository.findById("non-existent");
        expect(found).toBeNull();
    });

    it("should update an existing rule", async () => {
        await repository.save(mockRule);

        const updatedRule = { ...mockRule, priority: 10 };
        await repository.save(updatedRule);

        const found = await repository.findById(mockRule.id);
        expect(found?.priority).toBe(10);
    });

    it("should find all rules by childId", async () => {
        await repository.save(mockRule);

        const otherRule: ScheduleRule = {
            ...mockRule,
            id: "rule-999",
            name: "Other Rule",
            childId: "child-999" // different child
        };
        await repository.save(otherRule);

        const secondRuleForChild: ScheduleRule = {
            ...mockRule,
            id: "rule-456",
            name: "Second Rule"
        };
        await repository.save(secondRuleForChild);

        const rulesForChild = await repository.findAllByChildId("child-456");
        expect(rulesForChild.length).toBe(2);

        const ids = rulesForChild.map(r => r.id);
        expect(ids).toContain("rule-123");
        expect(ids).toContain("rule-456");
        expect(ids).not.toContain("rule-999");
    });

    it("should delete a rule", async () => {
        await repository.save(mockRule);

        await repository.delete(mockRule.id);

        const found = await repository.findById(mockRule.id);
        expect(found).toBeNull();
    });
});
