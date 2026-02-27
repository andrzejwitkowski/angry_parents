import { Elysia, t } from "elysia";
import type { TimelineServiceImpl } from "../../application/TimelineService";
import { CreateTimelineItemDto } from "../../core/domain/TimelineItem";
import { verifyJwt } from "../../lib/jwt";

function getJwtFromCookie(request: Request): string | null {
    const cookie = request.headers.get("Cookie");
    if (!cookie) return null;
    const match = cookie.match(/token=([^;]+)/);
    return match ? match[1] : null;
}

/**
 * Timeline REST API Controller
 * Primary Adapter - handles HTTP requests and delegates to service layer
 */
export function createTimelineController(service: TimelineServiceImpl) {
    return new Elysia({ prefix: "/api" })
        .derive(async ({ request }) => {
            const token = getJwtFromCookie(request);
            let user = null;
            if (token) {
                try {
                    const payload = await verifyJwt(token);
                    if (payload) {
                        user = {
                            id: payload.userId as string,
                            name: payload.role as string,
                            email: payload.email as string,
                            role: payload.role as string
                        };
                    }
                } catch (e) {
                    console.error("Invalid token in TimelineController", e);
                }
            }
            return { user };
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
            async ({ body, user }) => {
                try {
                    const userId = user?.id || "anonymous";
                    const userName = user?.name || "Unknown";

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
            async ({ params, body, user }) => {
                try {
                    if (!user) {
                        return { error: "Unauthorized", status: 401 };
                    }
                    const userName = user.name || "Unknown";
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const updated = await service.updateItem(params.id, body as any, user.id, userName);
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
            async ({ params, set, user }) => {
                try {
                    if (!user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    const userName = user.name || "Unknown";
                    await service.deleteItem(params.id, user.id, userName);
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
