import { Elysia, t } from "elysia";
import { ChildService } from "../../application/ChildService";
import type { Child } from "../../core/domain/child/Child";

export const createChildController = (childService: ChildService) => new Elysia({ prefix: "/api" })
    .get("/children", async () => {
        return await childService.getAllChildren();
    })
    .post("/children", async ({ body, set }) => {
        try {
            const childData = body as { name: string; icon: string; color: string };
            const child = await childService.addChild(childData);
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
    .patch("/children/:id", async ({ params, body, set }) => {
        try {
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
    .delete("/children/:id", async ({ params, set }) => {
        try {
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
