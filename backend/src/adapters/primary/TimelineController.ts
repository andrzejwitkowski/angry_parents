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

function mapErrorToStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    // 404 Not Found mappings
    if (lower.includes("not found")) {
        return 404;
    }

    // 403 Forbidden mappings
    const isForbidden = [
        "unauthorized",
        "modify your own",
        "does not belong",
        "parent role required"
    ].some(term => lower.includes(term));

    if (isForbidden) {
        return 403;
    }

    // 400 Bad Request mappings
    const isBadRequest = [
        "invalid",
        "required",
        "cannot encrypt",
        "must have registered"
    ].some(term => lower.includes(term)) || (error as any)?.name === "ZodError";

    if (isBadRequest) {
        return 400;
    }

    // Default to 500 Internal Server Error
    return 500;
}

function selectCiphertextForUser(items: any[], userId: string) {
    return items.map((item) => {
        const plainItem = item.toObject ? item.toObject() : item;
        const typedItem = plainItem as Record<string, any>;
        const payload = typedItem.encryptedPayload as Record<string, string> | undefined;
        if (!payload) return plainItem;

        // Return item with flattened ciphertext for the requesting user
        const { encryptedPayload, ...rest } = typedItem;
        let ciphertext = payload[userId];

        // DEV fallback: log a warning if ciphertext is missing for the user
        if (!ciphertext && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
            console.warn(`Missing ciphertext for userId: ${userId} in payload:`, payload);
        }

        return {
            ...rest,
            ciphertext: ciphertext ?? ""
        };
    });
}

function selectSingleCiphertextForUser(item: any, userId: string) {
    return selectCiphertextForUser([item], userId)[0];
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
                    set.status = mapErrorToStatus(error);
                    return { error: error instanceof Error ? error.message : String(error) };
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
                    set.status = mapErrorToStatus(error);
                    return { error: error instanceof Error ? error.message : String(error) };
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
                    if (!body.signatureBase64 || !body.timestamp || !body.keyId) {
                        set.status = 400;
                        return { error: "signatureBase64, timestamp, and keyId are required for data integrity" };
                    }

                    const item = await service.createItem({
                        ...body as CreateTimelineItemDto & { childId: string, signatureBase64: string, timestamp: string, keyId: string },
                        createdBy: userId,
                        createdByName: userName
                    });
                    const plainItem = (item as any).toObject ? (item as any).toObject() : item;
                    return selectSingleCiphertextForUser(plainItem, user.id);
                } catch (error) {
                    set.status = mapErrorToStatus(error);
                    return { error: error instanceof Error ? error.message : String(error) };
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
                    childId: t.String(), // Require childId for encryption Context (Family lookup)
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }, { additionalProperties: true }),
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

                    const payload = body as CreateTimelineItemDto & { childId: string; signatureBase64: string; timestamp: string; keyId: string };
                    if (!payload.childId || !payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
                        set.status = 400;
                        return { error: "childId, signatureBase64, timestamp, and keyId are required" };
                    }

                    const updated = await service.updateItem(
                        params.id,
                        payload as any,
                        user.id,
                        payload.childId,
                        {
                            signatureBase64: payload.signatureBase64,
                            timestamp: payload.timestamp,
                            keyId: payload.keyId
                        },
                        userName
                    );
                    const plainUpdated = (updated as any).toObject ? (updated as any).toObject() : updated;
                    return selectSingleCiphertextForUser(plainUpdated, user.id);
                } catch (error) {
                    set.status = mapErrorToStatus(error);
                    return { error: error instanceof Error ? error.message : String(error) };
                }
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                body: t.Object({
                    childId: t.String(),
                    signatureBase64: t.String(),
                    timestamp: t.String(),
                    keyId: t.String()
                }, { additionalProperties: true }),
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
                    if (!payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
                        set.status = 400;
                        return { error: "signatureBase64, timestamp, and keyId are required" };
                    }
                    const userName = user.name || "Unknown";
                    await service.deleteItem(params.id, user.id, {
                        signatureBase64: payload.signatureBase64,
                        timestamp: payload.timestamp,
                        keyId: payload.keyId
                    }, userName);
                    set.status = 204;
                    return null;
                } catch (error) {
                    set.status = mapErrorToStatus(error);
                    return { error: error instanceof Error ? error.message : String(error) };
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
