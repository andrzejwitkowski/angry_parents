import { ForensicService } from "./ForensicService";
import { IForensicRepository } from "../ports/IForensicRepository";

type CreatePendingPayload = {
    content: unknown;
    publicKey: string;
    signature: string;
    keyId: string;
    timestamp: string;
    signerId: string;
    index?: number;
    prevHash?: string;
};

type FinalizePayload = {
    index: number;
    publicKey: string;
    signature: string;
    keyId: string;
    signerId: string;
    existingTxHash?: string;
};

export class ForensicApiService {
    constructor(
        private readonly forensicService: ForensicService,
        private readonly forensicRepository: IForensicRepository
    ) { }

    async getChain() {
        const docs = await this.forensicRepository.getAllDocuments();
        const state = await this.forensicRepository.getSystemState();
        return {
            documents: docs,
            systemState: state
        };
    }

    async createPending(body: CreatePendingPayload) {
        const { content, publicKey, signature, keyId, timestamp, signerId, index, prevHash } = body;
        return this.forensicService.createPendingDocument(
            content,
            publicKey,
            signature,
            keyId,
            timestamp,
            signerId,
            index,
            prevHash
        );
    }

    async finalize(body: FinalizePayload) {
        const { index, publicKey, signature, keyId, signerId, existingTxHash } = body;
        return this.forensicService.finalizeDocument(
            index,
            publicKey,
            signature,
            keyId,
            signerId,
            existingTxHash
        );
    }
}
