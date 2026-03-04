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

function isParentRole(role?: string): role is "mom" | "dad" {
    return role === "mom" || role === "dad";
}

function selectCiphertextForUser(items: any[], userId: string) {
    return items.map((item) => {
        const typedItem = item as Record<string, any>;
        const payload = typedItem.encryptedPayload as Record<string, string> | undefined;
        if (!payload) return item;

        // Return item with flattened ciphertext for the requesting user
        const { encryptedPayload, ...rest } = typedItem;
        return {
            ...rest,
            ciphertext: payload[userId] ?? ""
        };
    });
}

function selectSingleCiphertextForUser(item: any, userId: string) {
    return selectCiphertextForUser([item], userId)[0];
}

/**
 * Timeline REST API Controller
 * Primary Adapter - handles HTTP requests and delegates to service layer
 * Redesigned for True End-to-End Encryption (E2EE)
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
            async ({ params, user, set }) => {
                try {
                    if (!user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    if (!isParentRole(user.role)) {
                        set.status = 403;
                        return { error: "Forbidden: parent role required" };
                    }
                    const items = await service.getItemsByDate(params.date);
                    return { items: selectCiphertextForUser(items, user.id) };
                } catch (error) {
                    set.status = 400;
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
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
            async ({ query, set, user }) => {
                try {
                    if (!user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    if (!isParentRole(user.role)) {
                        set.status = 403;
                        return { error: "Forbidden: parent role required" };
                    }
                    const items = await service.getItemsByDateRange(query.from, query.to);
                    return { items: selectCiphertextForUser(items, user.id) };
                } catch (error) {
                    set.status = 400;
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
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
            async ({ body, user, set }) => {
                try {
                    if (!isParentRole(user?.role)) {
                        set.status = 403;
                        return { error: "Forbidden: parent role required" };
                    }
                    const userId = user?.id || "anonymous";
                    const userName = user?.name || "Unknown";

                    const item = await service.createItem({
                        ...body as any,
                        createdBy: userId,
                        createdByName: userName
                    });
                    return selectSingleCiphertextForUser(item, user.id);
                } catch (error) {
                    set.status = 400;
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
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
                    date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
                    childIds: t.Array(t.String()),
                    encryptedPayload: t.Record(t.String(), t.String()),
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }),
            }
        )

        // PATCH /api/timeline/:id
        .patch(
            "/timeline/:id",
            async ({ params, body, user, set }) => {
                try {
                    if (!user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    if (!isParentRole(user.role)) {
                        set.status = 403;
                        return { error: "Forbidden: parent role required" };
                    }
                    const userName = user.name || "Unknown";

                    const updated = await service.updateItem(
                        params.id,
                        body as any,
                        user.id,
                        userName
                    );
                    return selectSingleCiphertextForUser(updated, user.id);
                } catch (error) {
                    set.status = 404;
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                    };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: t.Object({
                    date: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
                    childIds: t.Optional(t.Array(t.String())),
                    encryptedPayload: t.Optional(t.Record(t.String(), t.String())),
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }),
            }
        )

        // DELETE /api/timeline/:id
        .delete(
            "/timeline/:id",
            async ({ params, body, user, set }) => {
                try {
                    if (!user) {
                        set.status = 401;
                        return { error: "Unauthorized" };
                    }
                    if (!isParentRole(user.role)) {
                        set.status = 403;
                        return { error: "Forbidden: parent role required" };
                    }

                    const payload = body as { signatureBase64: string; timestamp: string; keyId: string };
                    const userName = user.name || "Unknown";

                    await service.deleteItem(params.id, user.id, {
                        signatureBase64: payload.signatureBase64,
                        timestamp: payload.timestamp,
                        keyId: payload.keyId
                    }, userName);
                    set.status = 204;
                    return null;
                } catch (error) {
                    set.status = 404;
                    return {
                        error: error instanceof Error ? error.message : "Unknown error",
                    };
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
