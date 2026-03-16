import type { TimelineServiceImpl } from "./TimelineService";
import type { CreateTimelineItemDto } from "../model/TimelineItem";
import type { SessionUser } from "../../shared/types/SessionUser";
import type { ChildRepository } from "../../family/ports/ChildRepository";
import type { TimelineRepository } from "../ports/TimelineRepository";
import type { EventProofRecord, EventProofStatus } from "../model/TimelineItem";

export type EventProofReadModel =
    | {
        status: Exclude<EventProofStatus, "CONFIRMED">;
        hash: string;
        submittedTxHash?: string;
        lastAttemptAt?: string;
        lastError?: string;
      }
    | {
        status: "CONFIRMED";
        hash: string;
        txHash: string;
        blockNumber: string;
      };

function isParentRole(role?: string): role is "mom" | "dad" {
    return role === "mom" || role === "dad";
}

function selectCiphertextForUser(items: any[], userId: string) {
    return items.map((item) => {
        const plainItem = item.toObject ? item.toObject() : item;
        const typedItem = plainItem as Record<string, any>;
        const payload = typedItem.encryptedPayload as Record<string, string> | undefined;
        if (!payload) return plainItem;

        const ciphertext = payload[userId];
        const { encryptedPayload: _, ...rest } = typedItem;

        if (!ciphertext && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
            console.warn(
                `Missing ciphertext for userId: ${userId}. Available encryptedPayload keys:`,
                Object.keys(payload)
            );
        }

        return {
            ...rest,
            ciphertext: ciphertext ?? ""
        };
    });
}

function selectSingleCiphertextForUser(item: any, userId: string) {
    return selectCiphertextForUser([item], userId)[0];
}

function toEventProofReadModel(proof: EventProofRecord): EventProofReadModel {
    const normalizedStatus = inferEventProofStatus(proof);

    if (normalizedStatus === "CONFIRMED") {
        return {
            status: "CONFIRMED",
            hash: proof.hash,
            txHash: proof.txHash!,
            blockNumber: proof.blockNumber!,
        };
    }

    return {
        status: normalizedStatus,
        hash: proof.hash,
        submittedTxHash: proof.submittedTxHash,
        lastAttemptAt: proof.lastAttemptAt,
        lastError: proof.lastError,
    };
}

function inferEventProofStatus(proof: Partial<EventProofRecord>): EventProofStatus {
    if (proof.status) {
        return proof.status;
    }
    if (proof.txHash && proof.blockNumber !== undefined && proof.anchoredAt) {
        return "CONFIRMED";
    }
    if (proof.submittedTxHash) {
        return "SUBMITTED";
    }
    return "CLAIMED";
}

function getPreferredProofForVersion(proofHistory: EventProofRecord[]): EventProofRecord | null {
    const confirmedProof = [...proofHistory].reverse().find((proof) => (
        inferEventProofStatus(proof) === "CONFIRMED"
        && Boolean(proof.txHash)
        && proof.blockNumber !== undefined
        && Boolean(proof.anchoredAt)
    ));
    if (confirmedProof) {
        return confirmedProof;
    }

    return proofHistory[proofHistory.length - 1] ?? null;
}

export class TimelineApiService {
    constructor(
        private readonly service: TimelineServiceImpl,
        private readonly childRepository?: ChildRepository,
        private readonly timelineRepository?: Pick<TimelineRepository, "findById" | "findByIdIncludingDeleted">,
        private readonly timelineEventProofService?: { publishProof(id: string, versionOrOptions?: number | { retryPending?: boolean }, maybeOptions?: { retryPending?: boolean }): Promise<{ txHash?: string; blockNumber?: string; hash: string }> }
    ) { }

    private assertAuthorizedTimelineUser(user: SessionUser | null): asserts user is SessionUser & { role: "mom" | "dad"; familyId: string } {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!isParentRole(user.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }
        if (!user.familyId) {
            const error = new Error("Unauthorized: No family assigned");
            (error as any).status = 401;
            throw error;
        }
    }

    private async ensureChildrenBelongToFamily(childIds: string[], familyId: string): Promise<void> {
        if (!this.childRepository) {
            return;
        }

        if (!Array.isArray(childIds) || childIds.length === 0) {
            throw new Error("Timeline item family mismatch");
        }

        const children = await Promise.all(childIds.map(async (childId) => {
            try {
                return await this.childRepository!.findById(childId);
            } catch (error) {
                const infrastructureError = new Error(`Failed to resolve child ownership for timeline item: ${(error as Error).message}`);
                (infrastructureError as any).cause = error;
                throw infrastructureError;
            }
        }));

        if (children.some((child) => !child || child.familyId !== familyId)) {
            throw new Error("Timeline item family mismatch");
        }
    }

    async getItemsByDate(date: string, user: SessionUser | null) {
        this.assertAuthorizedTimelineUser(user);
        const items = await this.service.getItemsByDate(date, user.familyId);
        return { items: selectCiphertextForUser(items, user.id) };
    }

    async getItemsByDateRange(from: string, to: string, user: SessionUser | null) {
        this.assertAuthorizedTimelineUser(user);
        const items = await this.service.getItemsByDateRange(from, to, user.familyId);
        return { items: selectCiphertextForUser(items, user.id) };
    }

    async getEventProof(id: string, user: SessionUser | null): Promise<EventProofReadModel> {
        this.assertAuthorizedTimelineUser(user);

        if (!this.timelineRepository) {
            throw new Error("Timeline proof repository not configured");
        }

        const item = await this.timelineRepository.findByIdIncludingDeleted(id);
        if (!item) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        try {
            await this.ensureChildrenBelongToFamily(item.childIds, user.familyId);
        } catch (error) {
            if (error instanceof Error && error.message === "Timeline item family mismatch") {
                throw new Error(`Timeline item with id ${id} not found`);
            }
            throw error;
        }

        if (!Array.isArray(item.versionHistory) || item.versionHistory.length === 0) {
            throw new Error(`Timeline item with id ${id} proof not found`);
        }

        const latestVersion = item.versionHistory[item.versionHistory.length - 1];
        const latestProof = getPreferredProofForVersion(latestVersion?.proofHistory ?? []);
        if (latestProof) {
            return toEventProofReadModel(latestProof);
        }

        throw new Error(`Timeline item with id ${id} proof not found`);
    }

    async publishEventProof(id: string, user: SessionUser | null) {
        this.assertAuthorizedTimelineUser(user);

        if (process.env.NODE_ENV === "production" && process.env.ENABLE_EVENT_PROOF_RECOVERY_ENDPOINT !== "true") {
            const error = new Error("Proof recovery endpoint disabled");
            (error as any).status = 403;
            throw error;
        }

        if (!this.timelineRepository || !this.timelineEventProofService) {
            throw new Error("Timeline proof publisher not configured");
        }

        const item = await this.timelineRepository.findByIdIncludingDeleted(id);
        if (!item) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        try {
            await this.ensureChildrenBelongToFamily(item.childIds, user.familyId);
        } catch (error) {
            if (error instanceof Error && error.message === "Timeline item family mismatch") {
                throw new Error(`Timeline item with id ${id} not found`);
            }
            throw error;
        }

        return this.timelineEventProofService.publishProof(id, { retryPending: true });
    }

    async createItem(body: any, user: SessionUser | null) {
        this.assertAuthorizedTimelineUser(user);

        if (!body.childId || !body.signatureBase64 || !body.timestamp || !body.keyId || !body.idempotencyKey) {
            const error = new Error("childId, signatureBase64, timestamp, keyId, and idempotencyKey are required for data integrity");
            (error as any).status = 400;
            throw error;
        }

        if (user.familyId && this.childRepository) {
            const child = await this.childRepository.findById(body.childId);
            if (!child || child.familyId !== user.familyId) {
                const error = new Error("Forbidden: child does not belong to your family");
                (error as any).status = 403;
                throw error;
            }
        }

        const userId = user.id;
        const userName = user.name || "Unknown";

        const item = await this.service.createItem({
            type: body.type,
            date: body.date,
            childId: body.childId,
            encryption: body.encryption,
            encryptedPayload: body.encryptedPayload,
            signatureBase64: body.signatureBase64,
            timestamp: body.timestamp,
            keyId: body.keyId,
            idempotencyKey: body.idempotencyKey,
            createdBy: userId,
            createdByName: userName
        } as any);

        const plainItem = (item as any).toObject ? (item as any).toObject() : item;
        return selectSingleCiphertextForUser(plainItem, userId);
    }

    async updateItem(id: string, body: any, user: SessionUser | null) {
        this.assertAuthorizedTimelineUser(user);

        const payload = body as CreateTimelineItemDto & { childId: string; signatureBase64: string; timestamp: string; keyId: string };
        if (!payload.childId || !payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
            const error = new Error("childId, signatureBase64, timestamp, and keyId are required");
            (error as any).status = 400;
            throw error;
        }

        const userName = user.name || "Unknown";
        const updated = await this.service.updateItem(
            id,
            payload as any,
            user.id,
            payload.childId,
            {
                signatureBase64: payload.signatureBase64,
                timestamp: payload.timestamp,
                keyId: payload.keyId
            },
            userName
        );
        const plainUpdated = (updated as any).toObject ? (updated as any).toObject() : updated;
        return selectSingleCiphertextForUser(plainUpdated, user.id);
    }

    async deleteItem(id: string, body: any, user: SessionUser | null): Promise<void> {
        this.assertAuthorizedTimelineUser(user);

        const payload = body as { signatureBase64: string; timestamp: string; keyId: string };
        if (!payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
            const error = new Error("signatureBase64, timestamp, and keyId are required");
            (error as any).status = 400;
            throw error;
        }

        const userName = user.name || "Unknown";
        await this.service.deleteItem(id, user.id, {
            signatureBase64: payload.signatureBase64,
            timestamp: payload.timestamp,
            keyId: payload.keyId
        }, userName);
    }
}
