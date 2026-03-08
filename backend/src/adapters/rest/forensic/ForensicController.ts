import { Elysia, t } from "elysia";
import { ForensicApiService } from "../../../domain/forensic/service/ForensicApiService";
import { formatErrorResponse } from "../common/errorMapper";

export const createForensicController = (service: ForensicApiService) => new Elysia({ prefix: "/forensic" })
    .get("/chain", async ({ set }) => {
        try {
            return await service.getChain();
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    })
    .post("/pending", async ({ body, set }) => {
        try {
            const doc = await service.createPending(body as any);
            return new Response(JSON.stringify(doc), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            content: t.Any(),
            publicKey: t.String(),
            signature: t.String(),
            keyId: t.String(),
            timestamp: t.String(),
            signerId: t.String(),
            index: t.Optional(t.Number()),
            prevHash: t.Optional(t.String())
        })
    })
    .post("/finalize", async ({ body, set }) => {
        try {
            const doc = await service.finalize(body as any);
            return new Response(JSON.stringify(doc), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            set.status = (error as any)?.status ?? 500;
            return { error: formatErrorResponse(error) };
        }
    }, {
        body: t.Object({
            index: t.Number(),
            publicKey: t.String(),
            signature: t.String(),
            keyId: t.String(),
            signerId: t.String(),
            existingTxHash: t.Optional(t.String())
        })
    });
