import { taskManager } from "../scheduler/instance";
import { TaskType } from "../scheduler/types";
import { createSyncUserPendingDocsHandler } from "../scheduler/handlers/SyncUserPendingDocs";
import { createProcessDocumentIntegrityHandler } from "../scheduler/handlers/ProcessDocumentIntegrity";
import { createBlockchainPublishHandler } from "../scheduler/handlers/BlockchainPublish";
import { createProcessForensicIntentHandler } from "../scheduler/handlers/ProcessForensicIntent";
import { createPublishEventProofHandler } from "../scheduler/handlers/PublishEventProof";
import type { IEventProofPublisher } from "../scheduler/handlers/PublishEventProof";
import { createReconcileEventProofHandler } from "../scheduler/handlers/ReconcileEventProof";
import type { IEventProofReconciler } from "../scheduler/handlers/ReconcileEventProof";
import type { IForensicRepository } from "../domain/forensic/ports/IForensicRepository";
import type { ICryptoService } from "../domain/shared/ports/ICryptoService";
import type { PasskeyRepository } from "../domain/auth/ports/PasskeyRepository";
import type { IBlockchainAnchor } from "../domain/shared/ports/IBlockchainAnchor";
import type { ForensicIntentRepository } from "../domain/forensic/ports/ForensicIntentRepository";
import type { ForensicService } from "../domain/forensic/service/ForensicService";

type SchedulerDependencies = {
    forensicRepository: IForensicRepository;
    cryptoService: ICryptoService;
    passkeyRepository: PasskeyRepository;
    blockchainAnchor: IBlockchainAnchor;
    forensicIntentRepository: ForensicIntentRepository;
    forensicService: ForensicService;
    timelineEventProofService: IEventProofPublisher;
    eventProofReconciliationService: IEventProofReconciler;
};

export function registerSchedulerHandlers(deps: SchedulerDependencies) {
    taskManager.registerHandler(
        TaskType.SYNC_USER_PENDING_DOCS,
        createSyncUserPendingDocsHandler(deps.forensicRepository, taskManager)
    );

    taskManager.registerHandler(
        TaskType.PROCESS_DOCUMENT_INTEGRITY,
        createProcessDocumentIntegrityHandler(deps.forensicRepository, deps.cryptoService, deps.passkeyRepository, taskManager)
    );

    taskManager.registerHandler(
        TaskType.BLOCKCHAIN_PUBLISH,
        createBlockchainPublishHandler(deps.forensicRepository, deps.blockchainAnchor)
    );

    taskManager.registerHandler(
        TaskType.PROCESS_FORENSIC_INTENT,
        createProcessForensicIntentHandler(deps.forensicIntentRepository, deps.forensicService)
    );

    taskManager.registerHandler(
        TaskType.PUBLISH_EVENT_PROOF,
        createPublishEventProofHandler(deps.timelineEventProofService)
    );

    taskManager.registerHandler(
        TaskType.RECONCILE_EVENT_PROOF,
        createReconcileEventProofHandler(deps.eventProofReconciliationService)
    );

    if (!taskManager.registerFailureHandler) {
        throw new Error("Task manager must support registerFailureHandler for event proof reconciliation");
    }

    if (!deps.eventProofReconciliationService.markProofReconciliationFailed) {
        throw new Error("Event proof reconciliation service must implement markProofReconciliationFailed");
    }

    const markProofReconciliationFailed =
        deps.eventProofReconciliationService.markProofReconciliationFailed.bind(deps.eventProofReconciliationService);

    taskManager.registerFailureHandler(
        TaskType.RECONCILE_EVENT_PROOF,
        async (payload, errorMessage) => {
            const typedPayload = payload as { itemId?: string; version?: number; submittedTxHash?: string };
            if (!typedPayload.itemId || typeof typedPayload.version !== "number") {
                return;
            }

            await markProofReconciliationFailed(
                typedPayload.itemId,
                typedPayload.version,
                errorMessage,
                typedPayload.submittedTxHash
            );
        }
    );
}
