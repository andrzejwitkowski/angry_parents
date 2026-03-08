import { taskManager } from "../scheduler/instance";
import { TaskType } from "../scheduler/types";
import { createSyncUserPendingDocsHandler } from "../scheduler/handlers/SyncUserPendingDocs";
import { createProcessDocumentIntegrityHandler } from "../scheduler/handlers/ProcessDocumentIntegrity";
import { createBlockchainPublishHandler } from "../scheduler/handlers/BlockchainPublish";
import { createProcessForensicIntentHandler } from "../scheduler/handlers/ProcessForensicIntent";

export function registerSchedulerHandlers(deps: {
    forensicRepository: any;
    cryptoService: any;
    passkeyRepository: any;
    blockchainAnchor: any;
    forensicIntentRepository: any;
    forensicService: any;
}) {
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
}
