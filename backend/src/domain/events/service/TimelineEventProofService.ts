import type { EncryptedTimelineItem, EncryptedTimelineVersionSnapshot, EventProofRecord, TimelineItemVersion } from "../model/TimelineItem";
import type { TimelineRepository } from "../ports/TimelineRepository";
import type { DateProvider } from "../../shared/ports/DateProvider";
import type { IEventBlockchainAnchor } from "../../shared/ports/IEventBlockchainAnchor";
import { calculateEventProofHash } from "./eventProofHash";

export class TimelineEventProofService {
    constructor(
        private readonly repository: TimelineRepository,
        private readonly blockchainAnchor: IEventBlockchainAnchor,
        private readonly dateProvider: DateProvider,
    ) {}

    private normalizeCreatedAt(value: unknown): string {
        const parsed = value instanceof Date ? value : new Date(value as any);
        if (Number.isNaN(parsed.getTime())) {
            return this.dateProvider.getIsoString();
        }

        return parsed.toISOString();
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

        const existingConfirmedProof = versionEntry.proofHistory.find(
            (proof) => proof.hash === hash && proof.txHash && proof.blockNumber !== undefined && proof.anchoredAt
        );
        if (existingConfirmedProof) {
            return existingConfirmedProof as Required<EventProofRecord> as EventProofRecord;
        }

        const existingPendingProof = versionEntry.proofHistory.find(
            (proof) => proof.hash === hash && (!proof.txHash || proof.blockNumber === undefined || !proof.anchoredAt)
        );
        if (existingPendingProof) {
            if (options.retryPending) {
                return this.completeProofPublication(id, versionEntry.version, hash);
            }
            throw new Error(
                `Proof publication already pending for timeline item ${id} version ${versionEntry.version}; manual recovery required`
            );
        }

        const claimed = await this.repository.claimPendingProofRecord(id, {
            version: versionEntry.version,
            hash,
        });
        if (!claimed) {
            throw new Error(
                `Proof publication already pending for timeline item ${id} version ${versionEntry.version}; manual recovery required`
            );
        }

        return this.completeProofPublication(id, versionEntry.version, hash);
    }

    private async completeProofPublication(id: string, version: number, hash: string): Promise<EventProofRecord> {
        try {
            const published = await this.blockchainAnchor.publishHash(hash);
            const proofRecord: EventProofRecord = {
                version,
                hash,
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
