import { Elysia, t } from "elysia";
import { CustodyApiService } from "../../../domain/events/service/CustodyApiService";
import { formatErrorResponse } from "../common/errorMapper";
import { resolveSessionUser } from "../common/authContext";

export const createCustodyController = (service: CustodyApiService) => new Elysia({ prefix: "/api" })
    .derive(async ({ request }) => ({
        user: await resolveSessionUser(request)
    }))
    .post("/custody/preview", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.preview(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            type: t.String(),
            startingParent: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
            handoverTime: t.Optional(t.String()),
            handoverEndTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String())),
            customBlockRepeatInterval: t.Optional(t.Number()),
            customBlockRepeatUnit: t.Optional(t.Union([t.Literal("DAYS"), t.Literal("WEEKS")])),
            customBlockEndDayOffset: t.Optional(t.Number()),
            customBlockStartDay: t.Optional(t.Number()),
            anchorDate: t.Optional(t.String())
        })
    })
    .post("/custody", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.saveEntries(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Array(t.Object({
            id: t.String(),
            childId: t.String(),
            date: t.String(),
            startTime: t.String(),
            endTime: t.String(),
            assignedTo: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
            isRecurring: t.Boolean(),
            priority: t.Number(),
            sourceRuleId: t.Optional(t.String())
        }))
    })
    .get("/custody", async ({ query, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.getResolvedCalendar(query as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        query: t.Object({
            start: t.String(),
            end: t.String(),
            childId: t.Optional(t.String())
        })
    })
    .post("/rules", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.createRule(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            type: t.String(),
            startingParent: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
            handoverTime: t.Optional(t.String()),
            handoverEndTime: t.Optional(t.String()),
            sequence: t.Optional(t.Array(t.Number())),
            holidays: t.Optional(t.Array(t.String())),
            customBlockRepeatInterval: t.Optional(t.Number()),
            customBlockRepeatUnit: t.Optional(t.Union([t.Literal("DAYS"), t.Literal("WEEKS")])),
            customBlockEndDayOffset: t.Optional(t.Number()),
            customBlockStartDay: t.Optional(t.Number()),
            anchorDate: t.Optional(t.String())
        })
    })
    .get("/rules", async ({ query, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.getRules((query as any).childId);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        query: t.Object({
            childId: t.String()
        })
    })
    .delete("/rules/:id", async ({ params, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.deleteRule(params.id);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    .post("/rules/:id/reorder", async ({ params, body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.reorderRule(params.id, (body as any).direction);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            direction: t.Union([t.Literal("UP"), t.Literal("DOWN")])
        })
    })
    .post("/rules/check-conflicts", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.checkConflicts((body as any).config, (body as any).excludeRuleId);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            config: t.Object({
                childId: t.String(),
                startDate: t.String(),
                endDate: t.String(),
                type: t.String(),
                startingParent: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
                handoverTime: t.Optional(t.String()),
                handoverEndTime: t.Optional(t.String()),
                sequence: t.Optional(t.Array(t.Number())),
                holidays: t.Optional(t.Array(t.String())),
                isOneTime: t.Optional(t.Boolean()),
                customBlockRepeatInterval: t.Optional(t.Number()),
                customBlockRepeatUnit: t.Optional(t.Union([t.Literal("DAYS"), t.Literal("WEEKS")])),
                customBlockEndDayOffset: t.Optional(t.Number()),
                customBlockStartDay: t.Optional(t.Number()),
                anchorDate: t.Optional(t.String())
            }),
            excludeRuleId: t.Optional(t.String())
        })
    })
    .post("/rules/fill-gaps", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.fillGaps(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            parent: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
            monthDate: t.String()
        })
    })
    .post("/rules/propagate/dry-run", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.propagateDryRun(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            childId: t.String(),
            currentMonthDate: t.String()
        })
    })
    .post("/rules/propagate", async ({ body, set, user }) => {
        try {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
            return await service.propagate(body as any);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            rulesToCreate: t.Array(t.Object({
                childId: t.String(),
                startDate: t.String(),
                endDate: t.String(),
                type: t.String(),
                startingParent: t.Union([t.Literal("MOM"), t.Literal("DAD")]),
                handoverTime: t.Optional(t.String()),
                handoverEndTime: t.Optional(t.String()),
                sequence: t.Optional(t.Array(t.Number())),
                holidays: t.Optional(t.Array(t.String())),
                isOneTime: t.Optional(t.Boolean()),
                customBlockRepeatInterval: t.Optional(t.Number()),
                customBlockRepeatUnit: t.Optional(t.Union([t.Literal("DAYS"), t.Literal("WEEKS")])),
                customBlockEndDayOffset: t.Optional(t.Number()),
                customBlockStartDay: t.Optional(t.Number()),
                anchorDate: t.Optional(t.String())
            }))
        })
    });
