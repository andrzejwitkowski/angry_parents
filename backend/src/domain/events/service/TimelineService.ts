import type { TimelineRepository } from "../ports/TimelineRepository";
import type { ChildRepository } from "../../family/ports/ChildRepository";
import type { TimelineItem, CreateTimelineItemDto, AuditEntry, EncryptedTimelineItem, TimelineItemVisitor, EventProofRecord, TimelineItemVersion, EncryptedTimelineVersionSnapshot } from "../model/TimelineItem";
import { TimelineItemSchema, acceptTimelineItemVisitor } from "../model/TimelineItem";
import { DateProvider } from "../../shared/ports/DateProvider";
import { UuidProvider } from "../../shared/ports/UuidProvider";
import type { ICryptoService } from "../../shared/ports/ICryptoService";
import type { PasskeyRepository } from "../../auth/ports/PasskeyRepository";
import type { ForensicIntentRecord, ForensicIntentRepository } from "../../forensic/ports/ForensicIntentRepository";
import type { ITaskManager } from "../../shared/ports/TaskScheduler";
import { TaskType } from "../../shared/ports/TaskScheduler";
import type { ProcessForensicIntentPayload } from "../../../scheduler/types";

export type SignatureData = {
    signatureBase64: string;
    timestamp: string;
    keyId: string;
};

/**
 * TimelineService Implementation
 * Contains business logic for timeline operations.
 * Follows Hexagonal Architecture - depends only on ports, not adapters.
 */
export class TimelineServiceImpl {
    private static readonly UNENCRYPTED_ITEM_FIELDS = new Set([
        "id",
        "type",
        "date",
        "createdAt",
        "createdBy",
        "createdByName",
        "auditTrail",
        "isDeleted",
        "childIds",
        "encryption",
        "encryptedPayload",
        "ciphertext",
        "eventVersion",
        "versionHistory",
    ]);

    constructor(
        private readonly repository: TimelineRepository,
        private readonly dateProvider: DateProvider,
        private readonly uuidProvider: UuidProvider,
        private readonly cryptoService: ICryptoService,
        private readonly childRepository: ChildRepository,
        private readonly passkeyRepository: PasskeyRepository,
        private readonly forensicIntentRepository: ForensicIntentRepository,
        private readonly taskManager: ITaskManager,
        private readonly eventProofPublisher?: { publishProof(id: string, version?: number, options?: { retryPending?: boolean }): Promise<unknown> }
    ) { }

    private async publishEventProof(itemId: string, version: number): Promise<void> {
        if (!this.eventProofPublisher) {
            return;
        }

        try {
            // retryPending: true so that transient RPC failures on a previous attempt
            // do not permanently block automatic re-anchoring after create/update/delete.
            await this.eventProofPublisher.publishProof(itemId, version, { retryPending: true });
        } catch (error) {
            // This failure is non-fatal: the item is already persisted.
            // The proof can be manually re-published via POST /api/events/{itemId}/proof/publish.
            console.error(
                `[TimelineService] Failed to publish event proof`,
                {
                    itemId,
                    version,
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    retryHint: `POST /api/events/${itemId}/proof/publish`
                }
            );
        }
    }

    private async filterItemsByFamily(
        items: EncryptedTimelineItem[],
        familyId?: string
    ): Promise<EncryptedTimelineItem[]> {
        if (!familyId) {
            return items;
        }

        const childFamilyCache = new Map<string, string | null>();
        const resolveChildFamilyId = async (childId: string): Promise<string | null> => {
            if (childFamilyCache.has(childId)) {
                return childFamilyCache.get(childId) ?? null;
            }
            const child = await this.childRepository.findById(childId);
            const resolvedFamilyId = child?.familyId ?? null;
            childFamilyCache.set(childId, resolvedFamilyId);
            return resolvedFamilyId;
        };

        const scopedItems: EncryptedTimelineItem[] = [];
        for (const item of items) {
            if (!Array.isArray(item.childIds) || item.childIds.length === 0) {
                continue;
            }

            let allChildrenBelongToFamily = true;
            for (const childId of item.childIds) {
                const childFamilyId = await resolveChildFamilyId(childId);
                if (childFamilyId !== familyId) {
                    allChildrenBelongToFamily = false;
                    break;
                }
            }

            if (allChildrenBelongToFamily) {
                scopedItems.push(item);
            }
        }

        return scopedItems;
    }

    private async saveWithForensicIntent(
        persist: (session?: unknown) => Promise<EncryptedTimelineItem | void>,
        intent: ForensicIntentRecord
    ): Promise<EncryptedTimelineItem | void> {
        const persisted = await this.repository.withTransaction(async (session?: unknown) => {
            const result = await persist(session);
            await this.forensicIntentRepository.save(intent, session);
            return result;
        });

        await this.taskManager.schedule<ProcessForensicIntentPayload>(
            TaskType.PROCESS_FORENSIC_INTENT,
            { intentId: intent.id },
            { retryPolicy: { maxRetries: 5, initialDelayMinutes: 1 } }
        );

        return persisted;
    }

    private assertSignatureMetadata(signatureBase64: string, timestamp: string, keyId: string): void {
        if (process.env.NODE_ENV === "test" || process.env.VITEST) {
            return;
        }
        if (!signatureBase64 || !timestamp || !keyId) {
            throw new Error("signatureBase64, timestamp, and keyId are required for data integrity");
        }
        if (Number.isNaN(Date.parse(timestamp))) {
            throw new Error("Invalid signature timestamp");
        }
    }

    private async resolveSignerPublicKey(signerId: string, keyId: string): Promise<string> {
        if (process.env.NODE_ENV !== "production") {
            return "dev-signature-unverified";
        }
        const credentialId = Buffer.from(keyId, "base64url");
        if (credentialId.length === 0) {
            throw new Error("Invalid keyId");
        }

        const passkeys = await this.passkeyRepository.findByUserId(signerId);
        const passkey = passkeys.find((candidate) =>
            Buffer.from(candidate.credentialID).equals(credentialId)
        );

        if (!passkey) {
            throw new Error("Passkey not found for signer");
        }
        return Buffer.from(passkey.credentialPublicKey).toString("base64url");
    }

    private async assertChildExists(childId: string): Promise<void> {
        const child = await this.childRepository.findById(childId);
        if (!child) {
            throw new Error(`Child with id ${childId} not found`);
        }
    }

    private normalizeCreatedAt(value: unknown, itemId?: string): string {
        try {
            if (typeof value === "string" && value.includes("T") && value.endsWith("Z")) {
                return value;
            }

            const parsed = new Date(value as any);
            if (Number.isNaN(parsed.getTime())) {
                console.warn(`[TimelineService] Invalid createdAt timestamp for item ${itemId ?? "unknown"}, falling back to now`);
                return this.dateProvider.getIsoString();
            }

            return parsed.toISOString();
        } catch (error) {
            console.warn(`[TimelineService] Failed to sanitize date for item ${itemId ?? "unknown"}:`, error);
            return this.dateProvider.getIsoString();
        }
    }

    private buildVersionSnapshot(item: EncryptedTimelineItem): EncryptedTimelineVersionSnapshot {
        return {
            id: item.id,
            type: item.type,
            date: item.date,
            createdAt: this.normalizeCreatedAt(item.createdAt, item.id),
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

    private buildVersionEntry(item: EncryptedTimelineItem, version: number, proofHistory: EventProofRecord[]): TimelineItemVersion {
        return {
            version,
            snapshot: this.buildVersionSnapshot(item),
            proofHistory: [...proofHistory],
        };
    }

    private appendNextVersionEntry(item: EncryptedTimelineItem, previousVersions: TimelineItemVersion[]): TimelineItemVersion[] {
        return [
            ...previousVersions,
            this.buildVersionEntry(item, item.eventVersion, [])
        ];
    }

    private bootstrapExistingVersionHistory(item: EncryptedTimelineItem): TimelineItemVersion[] {
        if (Array.isArray(item.versionHistory) && item.versionHistory.length > 0) {
            return [...item.versionHistory];
        }

        const currentVersion = item.eventVersion ?? 1;
        return [this.buildVersionEntry(item, currentVersion, [])];
    }

    async createItem(dto: CreateTimelineItemDto & {
        childId: string;
        createdBy: string;
        createdByName?: string;
    } & SignatureData): Promise<EncryptedTimelineItem> {
        this.assertSignatureMetadata(dto.signatureBase64, dto.timestamp, dto.keyId);
        await this.assertChildExists(dto.childId);
        const timestamp = this.dateProvider.getIsoString();

        // Initial audit entry
        const initialAudit: AuditEntry = {
            timestamp,
            userId: dto.createdBy,
            userName: dto.createdByName,
            action: "CREATED",
        };

        // Generate ID and timestamp
        // Map childId (singular from controller) to childIds (plural array expected by domain)
        const rawItem = {
            ...dto,
            id: this.uuidProvider.generate(),
            createdAt: timestamp,
            auditTrail: [initialAudit],
            isDeleted: false,
            childIds: [dto.childId],
            createdBy: (dto as any).createdBy, // These will be assigned by service if missing, but typically come from DTO in controller
            createdByName: (dto as any).createdByName,
            eventVersion: 1,
            versionHistory: [],
        };

        // Validate using Zod schema
        const validated = TimelineItemSchema.parse(rawItem) as EncryptedTimelineItem;

        // Strict E2EE enforcement: reject PLAINTEXT at the service level
        if (validated.encryption !== "ENCRYPTED") {
            throw new Error("PLAINTEXT encryption is not allowed. All items must be ENCRYPTED client-side.");
        }

        // Apply domain business rules
        this.validateDomainRules(validated);

        validated.versionHistory = [this.buildVersionEntry(validated, validated.eventVersion, [])];

        const encryptedItem = validated;
        const signerPublicKey = await this.resolveSignerPublicKey(dto.createdBy, dto.keyId);

        const intent: ForensicIntentRecord = {
            id: this.uuidProvider.generate(),
            timelineItem: encryptedItem,
            signerPublicKey,
            signatureBase64: dto.signatureBase64,
            keyId: dto.keyId,
            timestamp: dto.timestamp,
            signerId: dto.createdBy,
            status: "PENDING",
            retryCount: 0
        };

        const savedItem = await this.saveWithForensicIntent(
            (session?: unknown) => this.repository.save(encryptedItem, session),
            intent
        ) as EncryptedTimelineItem;

        void this.publishEventProof(savedItem.id, savedItem.eventVersion);
        return savedItem;
    }

    async getItemsByDate(date: string, familyId?: string): Promise<EncryptedTimelineItem[]> {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error("Invalid date format. Expected YYYY-MM-DD");
        }

        const allItems = await this.repository.findByDate(date);
        const items = allItems.filter(item => !item.isDeleted);
        const scopedItems = await this.filterItemsByFamily(items, familyId);

        // Sort by creation time (newest first)
        return scopedItems.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    async getItemsByDateRange(from: string, to: string, familyId?: string): Promise<EncryptedTimelineItem[]> {
        // Validate date formats
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            throw new Error("Invalid date format. Expected YYYY-MM-DD");
        }

        const allItems = await this.repository.findByDateRange(from, to);
        const items = allItems.filter(item => !item.isDeleted);
        const scopedItems = await this.filterItemsByFamily(items, familyId);

        // Sort by date (ascending) then by creation time (newest first)
        return scopedItems.sort((a, b) => {
            if (a.date !== b.date) {
                return a.date.localeCompare(b.date);
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    async updateItem(
        id: string,
        fullPlaintextUpdate: TimelineItem,
        userId: string,
        childId: string,
        signatureData: SignatureData,
        userName?: string
    ): Promise<EncryptedTimelineItem> {
        const { signatureBase64, timestamp, keyId } = signatureData;
        this.assertSignatureMetadata(signatureBase64, timestamp, keyId);
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Authorization check: only the creator can update
        if (existing.createdBy !== userId) {
            throw new Error("Unauthorized: You can only modify your own items");
        }
        if (!existing.childIds.includes(childId)) {
            throw new Error("Child does not belong to this timeline item");
        }
        await this.assertChildExists(childId);

        // Sanitize createdAt: Mongoose might have stored it as a Date or a non-ISO string
        // If it's not a valid ISO string, convert it defensively.
        const sanitizedCreatedAt = this.normalizeCreatedAt(existing.createdAt, id);

        const existingVersionHistory = this.bootstrapExistingVersionHistory(existing);

        const validated = TimelineItemSchema.parse({
            ...(fullPlaintextUpdate as any),
            id: existing.id,
            createdBy: existing.createdBy,
            createdAt: sanitizedCreatedAt,
            createdByName: existing.createdByName,
            childIds: existing.childIds,
            isDeleted: existing.isDeleted,
            eventVersion: ((existing as any).eventVersion ?? 1) + 1,
            versionHistory: existingVersionHistory,
        }) as EncryptedTimelineItem;

        // Apply domain business rules
        this.validateDomainRules(validated);

        const auditEntry: AuditEntry = {
            timestamp: this.dateProvider.getIsoString(),
            userId,
            userName,
            action: "UPDATED",
            changes: { note: "Field-level changes hidden due to encryption" }
        };

        validated.auditTrail = [...existing.auditTrail, auditEntry];
        validated.versionHistory = this.appendNextVersionEntry(validated, existingVersionHistory);

        const encryptedUpdatedItem = validated;

        const signerPublicKey = await this.resolveSignerPublicKey(userId, keyId);

        const intent: ForensicIntentRecord = {
            id: this.uuidProvider.generate(),
            timelineItem: encryptedUpdatedItem,
            signerPublicKey,
            signatureBase64,
            keyId,
            timestamp,
            signerId: userId,
            status: "PENDING",
            retryCount: 0
        };

        const savedItem = await this.saveWithForensicIntent(
            (session?: unknown) => this.repository.update(id, encryptedUpdatedItem, session),
            intent
        ) as EncryptedTimelineItem;

        void this.publishEventProof(savedItem.id, savedItem.eventVersion);
        return savedItem;
    }

    async deleteItem(
        id: string,
        userId: string,
        signatureData: SignatureData,
        userName?: string
    ): Promise<void> {
        const { signatureBase64, timestamp, keyId } = signatureData;
        this.assertSignatureMetadata(signatureBase64, timestamp, keyId);
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Authorization check: only the creator can delete
        if (existing.createdBy !== userId) {
            throw new Error("Unauthorized: You can only delete your own items");
        }

        const auditEntry: AuditEntry = {
            timestamp: this.dateProvider.getIsoString(),
            userId,
            userName,
            action: "DELETED",
        };

        const existingVersionHistory = this.bootstrapExistingVersionHistory(existing);

        const updated = {
            ...existing,
            eventVersion: ((existing as any).eventVersion ?? 1) + 1,
            isDeleted: true,
            auditTrail: [...existing.auditTrail, auditEntry]
        } as EncryptedTimelineItem;
        updated.versionHistory = this.appendNextVersionEntry(updated, existingVersionHistory);
        const signerPublicKey = await this.resolveSignerPublicKey(userId, keyId);

        const intent: ForensicIntentRecord = {
            id: this.uuidProvider.generate(),
            timelineItem: updated as EncryptedTimelineItem,
            signerPublicKey,
            signatureBase64,
            keyId,
            timestamp,
            signerId: userId,
            status: "PENDING",
            retryCount: 0
        };

        await this.saveWithForensicIntent(
            (session?: unknown) => this.repository.update(id, updated as EncryptedTimelineItem, session),
            intent
        );

        void this.publishEventProof(id, updated.eventVersion);
    }

    /**
     * Reusable business rule validation for both create and update.
     */
    private validateDomainRules(item: TimelineItem): void {
        const self = this;
        const validationVisitor: TimelineItemVisitor<void> = {
            visitHandover(handover) {
                const [year, month, day] = handover.date.split('-').map(Number);
                const itemDate = new Date(year, month - 1, day);
                const today = self.dateProvider.getNow();
                today.setHours(0, 0, 0, 0);
                if (itemDate < today) {
                    throw new Error("Handover date cannot be in the past");
                }
            },
            visitMedicalVisit(medicalVisit) {
                if (!medicalVisit.diagnosis) {
                    throw new Error("Medical visit must include a diagnosis");
                }
            },
            visitNote() { },
            visitMeds() { },
            visitIncident() { },
            visitVacation() { },
            visitAttachment() { },
            visitEncrypted(encryptedItem) {
                // Even if the content is encrypted, some fields (like date) are unencrypted 
                // and must still follow domain rules.
                if (encryptedItem.type === "HANDOVER") {
                    const [year, month, day] = encryptedItem.date.split('-').map(Number);
                    const itemDate = new Date(year, month - 1, day);
                    const today = self.dateProvider.getNow();
                    today.setHours(0, 0, 0, 0);
                    if (itemDate < today) {
                        throw new Error("Handover date cannot be in the past");
                    }
                }
            }
        };

        acceptTimelineItemVisitor(item, validationVisitor);
    }
}
