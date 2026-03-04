import type { ForensicService } from "../../application/ForensicService";
import type { ForensicIntentRepository } from "../../core/ports/ForensicIntentRepository";
import type { ProcessForensicIntentPayload } from "../types";

export const createProcessForensicIntentHandler = (
    forensicIntentRepository: ForensicIntentRepository,
    forensicService: ForensicService
) => async (payload: ProcessForensicIntentPayload): Promise<void> => {
    const intent = await forensicIntentRepository.findById(payload.intentId);
    if (!intent || intent.status === "COMPLETED") {
        return;
    }

    const claimed = await forensicIntentRepository.markProcessing(intent.id, 5); // 5 minute lease
    if (!claimed) return;

    try {
        await forensicService.createPendingDocument(
            intent.timelineItem,
            intent.signerPublicKey,
            intent.signatureBase64,
            intent.keyId,
            intent.timestamp,
            intent.signerId
        );
        await forensicIntentRepository.markCompleted(intent.id);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await forensicIntentRepository.markRetry(intent.id, message);
        throw error;
    }
};
