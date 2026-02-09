
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
        const { content, publicKey, signature, keyId, timestamp, signerId } = body;
        return await deps.forensicService.createPendingDocument(
            content,
            publicKey,
            signature,
            keyId,
            timestamp,
            signerId
        );
    }, {
        body: t.Object({
            content: t.Any(),
            publicKey: t.String(),
            signature: t.String(),
            keyId: t.String(),
            timestamp: t.String(),
            signerId: t.String()
        })
    })
    .post("/finalize", async ({ body }) => {
        const { index, publicKey, signature, keyId, existingTxHash, signerId } = body;
        return await deps.forensicService.finalizeDocument(
            index,
            publicKey,
            signature,
            keyId,
            signerId,
            existingTxHash
        );
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
