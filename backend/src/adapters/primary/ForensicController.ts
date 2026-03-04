
import { Elysia, t } from "elysia";
import { ForensicService } from "../../application/ForensicService";
import { IForensicRepository } from "../../core/ports/IForensicRepository";

// Helper type for dependency injection
type ForensicDeps = {
    forensicService: ForensicService;
    forensicRepository: IForensicRepository;
}

export const forensicController = (deps: ForensicDeps) => new Elysia({ prefix: "/forensic" })
    .get("/chain", async () => {
        const docs = await deps.forensicRepository.getAllDocuments();
        const state = await deps.forensicRepository.getSystemState();
        return {
            documents: docs,
            systemState: state
        };
    })
    .post("/pending", async ({ body }) => {
        const { content, publicKey, signature, keyId, timestamp, signerId, index, prevHash } = body;
        const doc = await deps.forensicService.createPendingDocument(
            content,
            publicKey,
            signature,
            keyId,
            timestamp,
            signerId,
            index,
            prevHash
        );
        return new Response(JSON.stringify(doc), {
            headers: { "Content-Type": "application/json" }
        });
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
    .post("/finalize", async ({ body }) => {
        const { index, publicKey, signature, keyId, existingTxHash, signerId } = body;
        const doc = await deps.forensicService.finalizeDocument(
            index,
            publicKey,
            signature,
            keyId,
            signerId,
            existingTxHash
        );
        return new Response(JSON.stringify(doc), {
            headers: { "Content-Type": "application/json" }
        });
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
