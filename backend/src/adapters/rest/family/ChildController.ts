import { Elysia, t } from "elysia";
import { resolveSessionUser } from "../common/authContext";
import { formatErrorResponse } from "../common/errorMapper";
import { FamilyApiService } from "../../../domain/family/service/FamilyApiService";

export const createChildController = (service: FamilyApiService) => new Elysia({ prefix: "/api" })
    .derive(async ({ request }) => ({
        user: await resolveSessionUser(request)
    }))
    .get("/children", async ({ user, set }) => {
        try {
            return await service.getAllChildren(user);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    })
    .post("/children", async ({ body, user, set }) => {
        try {
            return await service.addChild(body as { name: string; icon: string; color: string }, user);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            name: t.String(),
            icon: t.String(),
            color: t.String()
        })
    })
    .patch("/children/:id", async ({ params, body, user, set }) => {
        try {
            return await service.updateChild(params.id, body as Record<string, unknown>, user);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
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
    .delete("/children/:id", async ({ params, user, set }) => {
        try {
            return await service.deleteChild(params.id, user);
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    });
