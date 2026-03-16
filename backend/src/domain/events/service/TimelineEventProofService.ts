import { inferEventProofStatus, type EncryptedTimelineItem, type EncryptedTimelineVersionSnapshot, type EventProofRecord, type TimelineItemVersion } from "../model/TimelineItem";
import type { TimelineRepository } from "../ports/TimelineRepository";
import type { DateProvider } from "../../shared/ports/DateProvider";
import type { IEventBlockchainAnchor } from "../../shared/ports/IEventBlockchainAnchor";
import type { ITaskManager } from "../../shared/ports/TaskScheduler";
import { TaskType } from "../../shared/ports/TaskScheduler";
import type { ReconcileEventProofPayload } from "../../../scheduler/types";
import { calculateEventProofHash } from "./eventProofHash";

function isDelayedReceiptError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    return message.includes("receipt") && (
        message.includes("not available yet")
        || message.includes("not found")
        || message.includes("delayed")
    );
}

export class TimelineEventProofService {
    constructor(
        private readonly repository: TimelineRepository,
        private readonly blockchainAnchor: IEventBlockchainAnchor,
        private readonly dateProvider: DateProvider,
        private readonly taskManager?: ITaskManager,
    ) {}

    private normalizeCreatedAt(value: unknown): string {
        const parsed = value instanceof Date ? value : new Date(value as any);
        if (Number.isNaN(parsed.getTime())) {
            return this.dateProvider.getIsoString();
        }

        return parsed.toISOString();
    }

    private getLatestProofForHash(versionEntry: TimelineItemVersion, hash: string): EventProofRecord | undefined {
        return [...versionEntry.proofHistory].reverse().find((proof) => proof.hash === hash);
    }

    async publishProof(id: string, versionOrOptions?: number | { retryPending?: boolean }, maybeOptions?: { retryPending?: boolean }): Promise<EventProofRecord> {
        const item = await this.repository.findByIdIncludingDeleted(id);
        if (!item) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        const requestedVersion = typeof versionOrOptions === "number" ? versionOrOptions : undefined;
        const options = (typeof versionOrOptions === "number" ? maybeOptions : versionOrOptions) ?? {};

        const hydratedItem = await this.ensureVersionHistory(item);
        const activeVersion = requestedVersion ?? hydratedItem.eventVersion ?? 1;
        const versionEntry = this.getVersionEntry(hydratedItem, activeVersion);
        const hash = calculateEventProofHash(versionEntry.snapshot);

        const existingProof = this.getLatestProofForHash(versionEntry, hash);
        const existingConfirmedProof = existingProof
            && inferEventProofStatus(existingProof) === "CONFIRMED"
            && existingProof.txHash
            && existingProof.blockNumber !== undefined
            && existingProof.anchoredAt
            ? existingProof
            : undefined;
        if (existingConfirmedProof) {
            return existingConfirmedProof as Required<EventProofRecord> as EventProofRecord;
        }

        const existingPendingProof = existingProof && inferEventProofStatus(existingProof) !== "CONFIRMED"
            ? { ...existingProof, status: inferEventProofStatus(existingProof) }
            : undefined;
        if (existingPendingProof) {
            if (options.retryPending) {
                if (existingPendingProof.status === "SUBMITTED" && existingPendingProof.submittedTxHash) {
                    await this.scheduleReconciliation(id, versionEntry.version, existingPendingProof.submittedTxHash);
                    return existingPendingProof;
                }
                if (existingPendingProof.status === "FAILED" && existingPendingProof.submittedTxHash) {
                    const reconcilingProof: EventProofRecord = {
                        ...existingPendingProof,
                        status: "RECONCILING",
                        lastAttemptAt: this.dateProvider.getIsoString(),
                    };
                    await this.repository.replaceProofRecord(id, reconcilingProof);
                    await this.scheduleReconciliation(id, versionEntry.version, existingPendingProof.submittedTxHash);
                    return reconcilingProof;
                }
                if (existingPendingProof.status === "RECONCILING") {
                    if (existingPendingProof.submittedTxHash) {
                        await this.scheduleReconciliation(id, versionEntry.version, existingPendingProof.submittedTxHash);
                        return existingPendingProof;
                    }
                    return existingPendingProof;
                }
                if (existingPendingProof.status === "CLAIMED") {
                    return this.startClaimedProofPublication(id, versionEntry.version, hash);
                }
                return this.completeProofPublication(id, versionEntry.version, hash);
            }
            throw new Error(
                `Proof publication already pending for timeline item ${id} version ${versionEntry.version}; manual recovery required`
            );
        }

        await this.repository.appendProofRecord(id, {
            version: versionEntry.version,
            hash,
            status: "CLAIMED",
        });

        return this.startClaimedProofPublication(id, versionEntry.version, hash);
    }

    private async startClaimedProofPublication(id: string, version: number, hash: string): Promise<EventProofRecord> {
        const claimed = await this.repository.markProofTransitionInProgress(id, version, hash);
        if (!claimed) {
            const refreshed = await this.repository.findByIdIncludingDeleted(id);
            const refreshedVersionEntry = refreshed ? this.getVersionEntry(refreshed, version) : null;
            const refreshedProof = refreshedVersionEntry ? this.getLatestProofForHash(refreshedVersionEntry, hash) : undefined;
            if (refreshedProof) {
                const refreshedStatus = inferEventProofStatus(refreshedProof);
                if (refreshedStatus === "SUBMITTED" && refreshedProof.submittedTxHash) {
                    await this.scheduleReconciliation(id, version, refreshedProof.submittedTxHash);
                }
                return {
                    ...refreshedProof,
                    status: refreshedStatus,
                };
            }

            throw new Error(`Proof publication state changed unexpectedly for timeline item ${id} version ${version}`);
        }

        return this.completeProofPublication(id, version, hash);
    }

    private async completeProofPublication(id: string, version: number, hash: string): Promise<EventProofRecord> {
        try {
            let submittedTxHash: string;
            try {
                submittedTxHash = await this.blockchainAnchor.submitHash(hash);
            } catch (error) {
                await this.repository.resetProofTransitionClaim(id, version, hash);
                throw error;
            }
            const submittedProof: EventProofRecord = {
                version,
                hash,
                status: "SUBMITTED",
                submittedTxHash,
                lastAttemptAt: this.dateProvider.getIsoString(),
            };
            try {
                await this.repository.markProofSubmitted(id, submittedProof);
            } catch (error) {
                const recoveredSubmittedProof = {
                    ...submittedProof,
                    lastError: error instanceof Error ? error.message : String(error),
                };
                try {
                    await this.repository.replaceProofRecord(id, recoveredSubmittedProof);
                } catch {
                    return this.scheduleRecoveryAfterPersistenceFailure(id, version, hash, submittedTxHash, error);
                }
                await this.scheduleReconciliation(id, version, submittedTxHash);
                return recoveredSubmittedProof;
            }
            await this.scheduleReconciliation(id, version, submittedTxHash);

            let published;
            try {
                published = await this.blockchainAnchor.waitForPublication(submittedTxHash);
            } catch (error) {
                if (!isDelayedReceiptError(error)) {
                    throw error;
                }

                return submittedProof;
            }

            const proofRecord: EventProofRecord = {
                version,
                hash,
                status: "CONFIRMED",
                submittedTxHash,
                txHash: published.txHash,
                blockNumber: published.blockNumber.toString(),
                anchoredAt: this.dateProvider.getIsoString(),
            };

            await this.repository.appendProofRecord(id, proofRecord);
            return proofRecord;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown blockchain publish error";
            throw new Error(
                `Failed to publish event proof for timeline item ${id} version ${version}: ${message}`
            );
        }
    }

    private async scheduleRecoveryAfterPersistenceFailure(
        itemId: string,
        version: number,
        hash: string,
        submittedTxHash: string,
        error: unknown,
    ): Promise<EventProofRecord> {
        const recoverableProof: EventProofRecord = {
            version,
            hash,
            status: "SUBMITTED",
            submittedTxHash,
            lastAttemptAt: this.dateProvider.getIsoString(),
            lastError: error instanceof Error ? error.message : String(error),
        };

        try {
            await this.repository.appendProofRecord(itemId, recoverableProof);
        } catch {
            // Best effort: if we cannot persist a standalone recoverable marker,
            // the caller still receives the submitted tx hash for manual recovery.
        }

        await this.scheduleReconciliation(itemId, version, submittedTxHash);
        return recoverableProof;
    }

    private async scheduleReconciliation(itemId: string, version: number, submittedTxHash?: string): Promise<void> {
        if (!this.taskManager) {
            return;
        }

        try {
            await this.taskManager.schedule<ReconcileEventProofPayload>(
                TaskType.RECONCILE_EVENT_PROOF,
                { itemId, version, submittedTxHash },
                { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
            );
        } catch (error) {
            console.error("[TimelineEventProofService] Failed to schedule proof reconciliation", {
                itemId,
                version,
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async ensureVersionHistory(item: EncryptedTimelineItem): Promise<EncryptedTimelineItem> {
        if (Array.isArray(item.versionHistory) && item.versionHistory.length > 0) {
            return item;
        }

        const bootstrapVersion = item.eventVersion ?? 1;
        const snapshot = this.buildSnapshotFromItem(item);
        return this.repository.updateIncludingDeleted(item.id, {
            eventVersion: bootstrapVersion,
            versionHistory: [{
                version: bootstrapVersion,
                snapshot,
                proofHistory: [],
            }],
        });
    }

    private buildSnapshotFromItem(item: EncryptedTimelineItem): EncryptedTimelineVersionSnapshot {
        return {
            id: item.id,
            type: item.type,
            date: item.date,
            createdAt: this.normalizeCreatedAt(item.createdAt),
            createdBy: item.createdBy,
            createdByName: item.createdByName,
            auditTrail: [...item.auditTrail],
            isDeleted: item.isDeleted,
            childIds: [...item.childIds],
            encryption: item.encryption,
            encryptedPayload: { ...item.encryptedPayload },
            ...(item.ciphertext ? { ciphertext: item.ciphertext } : {}),
        };
    }

    private getVersionEntry(item: EncryptedTimelineItem, version: number): TimelineItemVersion {
        const versionEntry = item.versionHistory.find((entry) => entry.version === version);
        if (!versionEntry) {
            throw new Error(`Timeline item ${item.id} is missing version snapshot ${version}`);
        }

        return versionEntry;
    }
}
