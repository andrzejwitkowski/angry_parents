import { Elysia, t } from "elysia";
import type { TimelineServiceImpl } from "../../application/TimelineService";
import { CreateTimelineItemDto } from "../../core/domain/TimelineItem";
import { auth } from "../../lib/auth";

/**
 * Timeline REST API Controller
 * Primary Adapter - handles HTTP requests and delegates to service layer
 */
export function createTimelineController(service: TimelineServiceImpl) {
    return new Elysia({ prefix: "/api" })
        .derive(async ({ request }) => {
            const session = await auth.api.getSession({
                headers: request.headers
            });
            return { session };
        })
        // GET /api/calendar/:date/timeline
        .get(
            "/calendar/:date/timeline",
            async ({ params }) => {
                try {
                    const items = await service.getItemsByDate(params.date);
                    return { items };
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                        status: 400,
                    };
                }
            },
            {
                params: t.Object({
                    date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                }),
            }
        )

        // GET /api/timeline/range?from=YYYY-MM-DD&to=YYYY-MM-DD
        .get(
            "/timeline/range",
            async ({ query }) => {
                try {
                    const items = await service.getItemsByDateRange(query.from, query.to);
                    return { items };
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                        status: 400,
                    };
                }
            },
            {
                query: t.Object({
                    from: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                    to: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                }),
            }
        )

        // POST /api/timeline
        .post(
            "/timeline",
            async ({ body, session }) => {
                try {
                    const userId = session?.user?.id || "anonymous";
                    // Fallback to username if name is not set (Better Auth additional fields)
                    const userName = session?.user?.name || (session?.user as any)?.username || "Unknown";

                    const item = await service.createItem({
                        ...body as CreateTimelineItemDto,
                        createdBy: userId,

                        createdByName: userName
                    });
                    return item;
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                        status: 400,
                    };
                }
            },
            {
                body: t.Object({
                    type: t.Union([
                        t.Literal("NOTE"),
                        t.Literal("HANDOVER"),
                        t.Literal("MEDS"),
                        t.Literal("MEDICAL_VISIT"),
                        t.Literal("INCIDENT"),
                        t.Literal("VACATION"),
                        t.Literal("ATTACHMENT"),
                    ]),
                    date: t.String(),
                    createdBy: t.String(),
                    createdByName: t.Optional(t.String()),
                }, { additionalProperties: true }),
            }
        )

        // PATCH /api/timeline/:id
        .patch(
            "/timeline/:id",
            async ({ params, body, session }) => {
                try {
                    if (!session?.user) {
                        return { error: "Unauthorized", status: 401 };
                    }
                    const updated = await service.updateItem(params.id, body as any, session.user.id);
                    return updated;
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                        status: 404,
                    };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            }
        )

        // DELETE /api/timeline/:id
        .delete(
            "/timeline/:id",
            async ({ params, set, session }) => {
                try {
                    if (!session?.user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    await service.deleteItem(params.id, session.user.id);
                    set.status = 204;
                    return null;
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                        status: 404,
                    };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            }
        );
}
