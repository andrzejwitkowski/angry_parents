import type { PublishEventProofPayload } from "../types";

export interface IEventProofPublisher {
    publishProof(
        id: string,
        versionOrOptions?: number | { retryPending?: boolean },
        maybeOptions?: { retryPending?: boolean }
    ): Promise<unknown>;
}

/**
 * Task handler: publishes the blockchain proof for a specific timeline item version.
 *
 * Deduplication is automatic — the task payload { itemId, version } produces a
 * deterministic payloadHash, so scheduling the same (itemId, version) pair twice
 * while a task is still active is a no-op (TaskManager handles E11000 silently).
 */
export const createPublishEventProofHandler = (
    eventProofService: IEventProofPublisher
) => async (payload: PublishEventProofPayload): Promise<void> => {
    await eventProofService.publishProof(payload.itemId, payload.version, { retryPending: true });
};
