import { Elysia, t } from "elysia";
import { CustodyGenerator } from "../../application/CustodyGenerator";
import { CustodyPatternConfig } from "../../core/domain/child/CustodyPatternConfig";
import { CustodyRepository } from "../../core/ports/CustodyRepository";
import { CustodyEntry } from "../../core/domain/child/CustodyEntry";

import { ScheduleService } from "../../application/ScheduleService";
import { PropagationService } from "../../application/PropagationService";
import { UuidProvider } from "../../core/ports/UuidProvider";
import { startOfMonth, endOfMonth, parseISO, format, eachDayOfInterval, subDays, addDays } from "date-fns";

export const createCustodyController = (custodyRepository: CustodyRepository, scheduleService: ScheduleService, propagationService: PropagationService, uuidProvider: UuidProvider) => new Elysia({ prefix: "/api" })
    .post("/custody/preview", ({ body, set }) => {
        try {
            const config = body as unknown as CustodyPatternConfig;
            const generator = new CustodyGenerator(uuidProvider);
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
            handoverEndTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String())),
            customBlockRepeatInterval: t.Optional(t.Number()),
            customBlockRepeatUnit: t.Optional(t.Union([t.Literal('DAYS'), t.Literal('WEEKS')])),
            customBlockEndDayOffset: t.Optional(t.Number()),
            anchorDate: t.Optional(t.String())
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
            return await scheduleService.getResolvedCalendar(childId, start, end);
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
            handoverEndTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String())),
            customBlockRepeatInterval: t.Optional(t.Number()),
            customBlockRepeatUnit: t.Optional(t.Union([t.Literal('DAYS'), t.Literal('WEEKS')])),
            customBlockEndDayOffset: t.Optional(t.Number()),
            anchorDate: t.Optional(t.String())
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
    })
    .post("/rules/:id/reorder", async ({ params, body, set }) => {
        try {
            const { id } = params;
            const { direction } = body;
            await scheduleService.reorderRule(id, direction);
            return { success: true };
        } catch (e) {
            console.error("Error reordering rule:", e);
            set.status = 500;
            return { error: "Failed to reorder rule" };
        }
    }, {
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            direction: t.Union([t.Literal('UP'), t.Literal('DOWN')])
        })
    })
    .post("/rules/check-conflicts", async ({ body, set }) => {
        try {
            const { config, excludeRuleId } = body;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const conflicts = await scheduleService.checkConflicts(config as any, excludeRuleId);
            return { conflicts };
        } catch (e) {
            console.error("Error checking conflicts:", e);
            set.status = 500;
            return { error: "Failed to check conflicts" };
        }
    }, {
        body: t.Object({
            config: t.Object({
                childId: t.String(),
                startDate: t.String(),
                endDate: t.String(),
                type: t.String(),
                startingParent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
                handoverTime: t.Optional(t.String()),
                handoverEndTime: t.Optional(t.String()),
                sequence: t.Optional(t.Array(t.Number())),
                holidays: t.Optional(t.Array(t.String())),
                isOneTime: t.Optional(t.Boolean()),
                customBlockRepeatInterval: t.Optional(t.Number()),
                customBlockRepeatUnit: t.Optional(t.Union([t.Literal('DAYS'), t.Literal('WEEKS')])),
                customBlockEndDayOffset: t.Optional(t.Number()),
                anchorDate: t.Optional(t.String())
            }),
            excludeRuleId: t.Optional(t.String())
        })
    })
    .post("/rules/fill-gaps", async ({ body, set }) => {
        try {
            const { childId, parent, monthDate } = body;

            // 1. Delete existing GAP_FILL rules
            await scheduleService.deleteGapFillRulesByChild(childId);

            // 2. Determine Month Range + Buffer for Anchors
            const monthStart = startOfMonth(parseISO(monthDate));
            const monthEnd = endOfMonth(parseISO(monthDate));

            const bufferStart = subDays(monthStart, 1);
            const bufferEnd = addDays(monthEnd, 1);

            const bufferStartStr = format(bufferStart, 'yyyy-MM-dd');
            const bufferEndStr = format(bufferEnd, 'yyyy-MM-dd');

            // 3. Fetch Resolved Calendar (Current Schedule)
            const entries = await scheduleService.getResolvedCalendar(childId, bufferStartStr, bufferEndStr);

            // Map entries by date for O(1) lookup
            const entryMap = new Map<string, CustodyEntry>();
            entries.forEach(e => entryMap.set(e.date, e));

            // 4. Iterate Month Days to find gaps
            const daysOfMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
            const gaps: string[] = []; // List of YYYY-MM-DD that are unassigned

            for (const day of daysOfMonth) {
                const dateStr = format(day, "yyyy-MM-dd");
                if (!entryMap.has(dateStr)) {
                    gaps.push(dateStr);
                }
            }

            if (gaps.length === 0) {
                return { success: true, count: 0, message: "No gaps found" };
            }

            // 5. Group contiguous gaps into spans
            const spans: string[][] = [];
            let currentSpan: string[] = [];

            for (let i = 0; i < gaps.length; i++) {
                const date = gaps[i];
                if (currentSpan.length === 0) {
                    currentSpan.push(date);
                } else {
                    const lastDate = parseISO(currentSpan[currentSpan.length - 1]);
                    const currentDate = parseISO(date);
                    const diff = currentDate.getTime() - lastDate.getTime();
                    const oneDay = 1000 * 60 * 60 * 24;

                    if (diff <= oneDay + 1000) { // Contiguous (allow ms drift)
                        currentSpan.push(date);
                    } else {
                        spans.push(currentSpan);
                        currentSpan = [date];
                    }
                }
            }
            if (currentSpan.length > 0) spans.push(currentSpan);

            // 6. Create Rule for each Span
            const ruleIds: string[] = [];

            for (const span of spans) {
                const spanStartDate = parseISO(span[0]);
                const spanEndDate = parseISO(span[span.length - 1]);

                // Determine Anchors
                const dayBefore = subDays(spanStartDate, 1);
                const dayAfter = addDays(spanEndDate, 1);

                const dayBeforeStr = format(dayBefore, 'yyyy-MM-dd');
                const dayAfterStr = format(dayAfter, 'yyyy-MM-dd');

                const anchorBefore = entryMap.get(dayBeforeStr)?.sourceRuleId;
                const anchorAfter = entryMap.get(dayAfterStr)?.sourceRuleId;

                const config: CustodyPatternConfig = {
                    childId,
                    startDate: span[0],
                    endDate: span[span.length - 1],
                    type: 'GAP_FILL',
                    startingParent: parent,
                    anchorBeforeRuleId: anchorBefore,
                    anchorAfterRuleId: anchorAfter
                    // isRecurring: true implicitly by generator strategy
                };

                const rule = await scheduleService.createRule(config);
                ruleIds.push(rule.id);
            }

            return { success: true, count: ruleIds.length, ruleIds };

        } catch (e) {
            console.error("Error checking conflicts:", e);
            set.status = 500;
            return { error: "Failed to check conflicts" };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            parent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
            monthDate: t.String()
        })
    })
    .post("/rules/propagate/dry-run", async ({ body, set }) => {
        try {
            const { childId, currentMonthDate } = body;
            const result = await propagationService.simulatePropagation(childId, currentMonthDate);
            return result;
        } catch (e) {
            console.error("Error dry-run propagation:", e);
            set.status = 500;
            return { error: "Failed to simulate propagation" };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            currentMonthDate: t.String()
        })
    })
    .post("/rules/propagate", async ({ body, set }) => {
        try {
            const { rulesToCreate } = body;
            const createdRules = [];
            for (const config of rulesToCreate) {
                // Ensure isOneTime is false for propagated rules? Or explicitly set?
                // PropagationService already generates them.
                const rule = await scheduleService.createRule(config as unknown as CustodyPatternConfig);
                createdRules.push(rule);
            }
            return { success: true, count: createdRules.length };
        } catch (e) {
            console.error("Error executing propagation:", e);
            set.status = 500;
            return { error: "Failed to execute propagation" };
        }
    }, {
        body: t.Object({
            rulesToCreate: t.Array(t.Object({
                childId: t.String(),
                startDate: t.String(),
                endDate: t.String(),
                type: t.String(),
                startingParent: t.Union([t.Literal('MOM'), t.Literal('DAD')]),
                handoverTime: t.Optional(t.String()),
                handoverEndTime: t.Optional(t.String()),
                sequence: t.Optional(t.Array(t.Number())),
                holidays: t.Optional(t.Array(t.String())),
                isOneTime: t.Optional(t.Boolean()),
                customBlockRepeatInterval: t.Optional(t.Number()),
                customBlockRepeatUnit: t.Optional(t.Union([t.Literal('DAYS'), t.Literal('WEEKS')])),
                customBlockEndDayOffset: t.Optional(t.Number()),
                anchorDate: t.Optional(t.String())
            }))
        })
    });
