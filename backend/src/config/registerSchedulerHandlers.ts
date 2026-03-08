import { taskManager } from "../scheduler/instance";
import { TaskType } from "../scheduler/types";
import { createSyncUserPendingDocsHandler } from "../scheduler/handlers/SyncUserPendingDocs";
import { createProcessDocumentIntegrityHandler } from "../scheduler/handlers/ProcessDocumentIntegrity";
import { createBlockchainPublishHandler } from "../scheduler/handlers/BlockchainPublish";
import { createProcessForensicIntentHandler } from "../scheduler/handlers/ProcessForensicIntent";
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
}
