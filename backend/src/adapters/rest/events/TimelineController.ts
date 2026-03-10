import { Elysia, t } from "elysia";
import { resolveSessionUser } from "../common/authContext";
import { formatErrorResponse, mapErrorToStatus } from "../common/errorMapper";
import { TimelineApiService } from "../../../domain/events/service/TimelineApiService";

export { mapErrorToStatus } from "../common/errorMapper";

export function createTimelineController(service: TimelineApiService) {
    return new Elysia({ prefix: "/api" })
        .derive(async ({ request }) => {
            const user = await resolveSessionUser(request);
            return { user };
        })
        .get(
            "/calendar/:date/timeline",
            async ({ params, user, set }) => {
                try {
                    return await service.getItemsByDate(params.date, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                params: t.Object({
                    date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                }),
            }
        )
        .get(
            "/timeline/range",
            async ({ query, set, user }) => {
                try {
                    return await service.getItemsByDateRange(query.from, query.to, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                query: t.Object({
                    from: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                    to: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                }),
            }
        )
        .get(
            "/events/:id/proof",
            async ({ params, user, set }) => {
                try {
                    return await service.getEventProof(params.id, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            }
        )
        .post(
            "/events/:id/proof/publish",
            async ({ params, user, set }) => {
                try {
                    return await service.publishEventProof(params.id, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
            }
        )
        .post(
            "/timeline",
            async ({ body, user, set }) => {
                try {
                    return await service.createItem(body, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
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
                    date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                    childId: t.String(),
                    encryption: t.Literal("ENCRYPTED"),
                    encryptedPayload: t.Record(t.String(), t.String()),
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }),
            }
        )
        .patch(
            "/timeline/:id",
            async ({ params, body, user, set }) => {
                try {
                    return await service.updateItem(params.id, body, user);
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: t.Object({
                    childId: t.String(),
                    encryption: t.Literal("ENCRYPTED"),
                    encryptedPayload: t.Record(t.String(), t.String()),
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }, { additionalProperties: true }),
            }
        )
        .delete(
            "/timeline/:id",
            async ({ params, body, user, set }) => {
                try {
                    await service.deleteItem(params.id, body, user);
                    set.status = 204;
                    return null;
                } catch (error) {
                    set.status = (error as any)?.status ?? mapErrorToStatus(error);
                    return { error: formatErrorResponse(error) };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: t.Object({
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                })
            }
        );
}
