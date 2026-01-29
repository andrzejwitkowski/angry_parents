import { Elysia, t } from "elysia";
import { CustodyGenerator } from "../../application/CustodyGenerator";
import { CustodyPatternConfig } from "../../core/domain/child/CustodyPatternConfig";
import { CustodyRepository } from "../../core/ports/CustodyRepository";
import { CustodyEntry } from "../../core/domain/child/CustodyEntry";

import { ScheduleService } from "../../application/ScheduleService";

export const createCustodyController = (custodyRepository: CustodyRepository, scheduleService: ScheduleService) => new Elysia({ prefix: "/api" })
    .post("/custody/preview", ({ body, set }) => {
        try {
            const config = body as unknown as CustodyPatternConfig;
            const generator = new CustodyGenerator();
            return generator.generate(config);
        } catch (e) {
            console.error("Error generating custody preview:", e);
            set.status = 500;
            return { error: "Failed to generate custody schedule" };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            type: t.String(),
            startingParent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
            handoverTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String()))
        })
    })
    .post("/custody", async ({ body, set }) => {
        try {
            const entries = body as CustodyEntry[];
            await custodyRepository.save(entries);
            return { success: true, count: entries.length };
        } catch (e) {
            console.error("Error saving custody entries:", e);
            set.status = 500;
            return { error: "Failed to save custody entries" };
        }
    }, {
        body: t.Array(t.Object({
            id: t.String(),
            childId: t.String(),
            date: t.String(),
            startTime: t.String(),
            endTime: t.String(),
            assignedTo: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
            isRecurring: t.Boolean(),
            priority: t.Number(),
            sourceRuleId: t.Optional(t.String())
        }))
    })
    .get("/custody", async ({ query, set }) => {
        try {
            const { start, end, childId } = query;
            if (!start || !end) {
                set.status = 400;
                return { error: "Missing start or end date" };
            }
            return await custodyRepository.findByDateRange(childId, start, end);
        } catch (e) {
            console.error("Error fetching custody entries:", e);
            set.status = 500;
            return { error: "Failed to fetch custody entries" };
        }
    }, {
        query: t.Object({
            start: t.String(),
            end: t.String(),
            childId: t.Optional(t.String())
        })
    })
    // --- Schedule Rules API ---
    .post("/rules", async ({ body, set }) => {
        try {
            const config = body as unknown as CustodyPatternConfig;
            const rule = await scheduleService.createRule(config);
            return { success: true, ruleId: rule.id };
        } catch (e) {
            console.error("Error creating schedule rule:", e);
            set.status = 500;
            return { error: "Failed to create schedule rule" };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            type: t.String(),
            startingParent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
            handoverTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String()))
        })
    })
    .get("/rules", async ({ query, set }) => {
        try {
            const { childId } = query;
            if (!childId) {
                set.status = 400;
                return { error: "Missing childId" };
            }
            return await scheduleService.getRulesByChild(childId);
        } catch (e) {
            console.error("Error fetching rules:", e);
            set.status = 500;
            return { error: "Failed to fetch rules" };
        }
    }, {
        query: t.Object({
            childId: t.String()
        })
    })
    .delete("/rules/:id", async ({ params, set }) => {
        try {
            const { id } = params;
            await scheduleService.deleteRule(id);
            return { success: true };
        } catch (e) {
            console.error("Error deleting rule:", e);
            set.status = 500;
            return { error: "Failed to delete rule" };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    });
