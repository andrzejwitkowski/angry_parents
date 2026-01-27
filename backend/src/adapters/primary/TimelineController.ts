import { Elysia, t } from "elysia";
import type { TimelineServiceImpl } from "../../application/TimelineService";
import { CreateTimelineItemDto } from "../../core/domain/TimelineItem";

/**
 * Timeline REST API Controller
 * Primary Adapter - handles HTTP requests and delegates to service layer
 */
export function createTimelineController(service: TimelineServiceImpl) {
    return new Elysia({ prefix: "/api" })
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

        // POST /api/timeline
        .post(
            "/timeline",
            async ({ body }) => {
                try {
                    const item = await service.createItem(body as CreateTimelineItemDto);
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
                }, { additionalProperties: true }),
            }
        )

        // PATCH /api/timeline/:id
        .patch(
            "/timeline/:id",
            async ({ params, body }) => {
                try {
                    const updated = await service.updateItem(params.id, body);
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
            async ({ params, set }) => {
                try {
                    await service.deleteItem(params.id);
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
