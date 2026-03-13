import type { EventProofRecord, TimelineItemVersion } from "../model/TimelineItem";
import type { TimelineRepository } from "../ports/TimelineRepository";
import type { IEventBlockchainAnchor } from "../../shared/ports/IEventBlockchainAnchor";
import type { DateProvider } from "../../shared/ports/DateProvider";

export class EventProofReconciliationService {
    constructor(
        private readonly repository: TimelineRepository,
        private readonly blockchainAnchor: IEventBlockchainAnchor,
        private readonly dateProvider: DateProvider,
    ) {}

    async reconcileProof(itemId: string, version: number, submittedTxHash?: string): Promise<EventProofRecord> {
        const item = await this.repository.findByIdIncludingDeleted(itemId);
        if (!item) {
            throw new Error(`Timeline item with id ${itemId} not found`);
        }

        const versionEntry = item.versionHistory.find((entry) => entry.version === version);
        if (!versionEntry || versionEntry.proofHistory.length === 0) {
            throw new Error(`No proof record found for timeline item ${itemId} version ${version}`);
        }

        const proof = this.getCurrentProof(versionEntry);
        if (proof.status === "CONFIRMED") {
            return proof;
        }

        const resolvedSubmittedTxHash = proof.submittedTxHash ?? submittedTxHash;
        if ((proof.status !== "SUBMITTED" && proof.status !== "RECONCILING") || !resolvedSubmittedTxHash) {
            return proof;
        }

        const receipt = await this.blockchainAnchor.getReceipt(resolvedSubmittedTxHash);
        if (!receipt) {
            if (!proof.submittedTxHash) {
                const pendingProof: EventProofRecord = {
                    ...proof,
                    submittedTxHash: resolvedSubmittedTxHash,
                };
                await this.repository.replaceProofRecord(itemId, pendingProof);
                return pendingProof;
            }

            return proof;
        }

        const confirmedProof: EventProofRecord = {
            ...proof,
            status: "CONFIRMED",
            submittedTxHash: resolvedSubmittedTxHash,
            txHash: receipt.txHash,
            blockNumber: receipt.blockNumber.toString(),
            anchoredAt: this.dateProvider.getIsoString(),
        };

        await this.repository.appendProofRecord(itemId, confirmedProof);
        return confirmedProof;
    }

    async markProofReconciliationFailed(itemId: string, version: number, errorMessage: string, submittedTxHash?: string): Promise<EventProofRecord> {
        const item = await this.repository.findByIdIncludingDeleted(itemId);
        if (!item) {
            throw new Error(`Timeline item with id ${itemId} not found`);
        }

        const versionEntry = item.versionHistory.find((entry) => entry.version === version);
        if (!versionEntry || versionEntry.proofHistory.length === 0) {
            throw new Error(`No proof record found for timeline item ${itemId} version ${version}`);
        }

        const proof = this.getCurrentProof(versionEntry);
        const failedProof: EventProofRecord = {
            ...proof,
            status: "FAILED",
            submittedTxHash: proof.submittedTxHash ?? submittedTxHash,
            lastAttemptAt: this.dateProvider.getIsoString(),
            lastError: errorMessage,
        };

        await this.repository.replaceProofRecord(itemId, failedProof);
        return failedProof;
    }

    private getCurrentProof(versionEntry: TimelineItemVersion): EventProofRecord {
        const confirmedProof = versionEntry.proofHistory.find((proof) => proof.status === "CONFIRMED");
        if (confirmedProof) {
            return confirmedProof;
        }

        return versionEntry.proofHistory[versionEntry.proofHistory.length - 1];
    }
}
