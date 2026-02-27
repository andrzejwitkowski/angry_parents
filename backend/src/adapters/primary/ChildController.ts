import { Elysia, t } from "elysia";
import { ChildService } from "../../application/ChildService";
import type { Child } from "../../core/domain/child/Child";
import { verifyJwt } from "../../lib/jwt";

function getJwtFromCookie(request: Request): string | null {
    const cookie = request.headers.get("Cookie");
    if (!cookie) return null;
    const match = cookie.match(/token=([^;]+)/);
    return match ? match[1] : null;
}

export const createChildController = (childService: ChildService) => new Elysia({ prefix: "/api" })
    .get("/children", async ({ request, set }) => {
        const token = getJwtFromCookie(request);
        if (!token) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }
        try {
            const payload = await verifyJwt(token);
            if (!payload?.familyId) {
                set.status = 401;
                return { error: 'Unauthorized: No family assigned' };
            }
            return await childService.getAllChildren(payload.familyId as string);
        } catch (e) {
            set.status = 401;
            return { error: 'Invalid token' };
        }
    })
    .post("/children", async ({ request, body, set }) => {
        try {
            const token = getJwtFromCookie(request);
            if (!token) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }
            const payload = await verifyJwt(token);
            if (!payload?.familyId) {
                set.status = 401;
                return { error: 'Unauthorized: No family assigned' };
            }

            const childData = body as { name: string; icon: string; color: string };
            const child = await childService.addChild(payload.familyId as string, childData);
            return child;
        } catch (e) {
            console.error("Error adding child:", e);
            set.status = 500;
            return { error: "Failed to add child" };
        }
    }, {
        body: t.Object({
            name: t.String(),
            icon: t.String(),
            color: t.String()
        })
    })
    .patch("/children/:id", async ({ request, params, body, set }) => {
        try {
            const token = getJwtFromCookie(request);
            if (!token) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }
            const payload = await verifyJwt(token);
            if (!payload?.familyId) {
                set.status = 401;
                return { error: 'Unauthorized: No family assigned' };
            }
            // Ideally check if child belongs to familyId, but leaving as is for now
            return await childService.updateChild(params.id, body as Partial<Child>);
        } catch (e) {
            console.error("Error updating child:", e);
            set.status = 500;
            return { error: (e as Error).message };
        }
    }, {
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            icon: t.Optional(t.String()),
            color: t.Optional(t.String())
        })
    })
    .delete("/children/:id", async ({ request, params, set }) => {
        try {
            const token = getJwtFromCookie(request);
            if (!token) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }
            const payload = await verifyJwt(token);
            if (!payload?.familyId) {
                set.status = 401;
                return { error: 'Unauthorized: No family assigned' };
            }

            await childService.deleteChild(params.id);
            return { success: true };
        } catch (e) {
            const message = (e as Error).message;
            console.error("Error deleting child:", message);
            set.status = message.includes("linked") ? 400 : 500;
            return { error: message };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    });
