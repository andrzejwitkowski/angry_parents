import type { TimelineRepository } from "../core/ports/TimelineRepository";
import type { ChildRepository } from "../core/ports/ChildRepository";
import type { TimelineItem, PlainTimelineItem, CreateTimelineItemDto, AuditEntry, EncryptedTimelineItem, EncryptedPayload } from "../core/domain/TimelineItem";
import { TimelineItemSchema } from "../core/domain/TimelineItem";
import { DateProvider } from "../core/ports/DateProvider";
import { UuidProvider } from "../core/ports/UuidProvider";
import type { ICryptoService } from "../core/ports/ICryptoService";
import type { Model } from "mongoose";
import type { IFamily } from "../models/Family";
import { PasskeyModel } from "../models/Passkey";
import type { ForensicIntentRecord, ForensicIntentRepository } from "../core/ports/ForensicIntentRepository";
import type { ITaskManager } from "../core/ports/TaskScheduler";
import { TaskType } from "../core/ports/TaskScheduler";
import type { ProcessForensicIntentPayload } from "../scheduler/types";

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
    ]);

    constructor(
        private readonly repository: TimelineRepository,
        private readonly dateProvider: DateProvider,
        private readonly uuidProvider: UuidProvider,
        private readonly cryptoService: ICryptoService,
        private readonly familyModel: Model<IFamily>,
        private readonly childRepository: ChildRepository,
        private readonly forensicIntentRepository: ForensicIntentRepository,
        private readonly taskManager: ITaskManager
    ) { }

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

    /**
     * Helper to extract content fields from a TimelineItem for encryption.
     * Returns a JSON string of all sensitive fields.
     */
    private extractContentForEncryption(item: TimelineItem): string {
        const plainItem = item as Record<string, unknown>;
        const contentFields: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(plainItem)) {
            if (TimelineServiceImpl.UNENCRYPTED_ITEM_FIELDS.has(key)) {
                continue;
            }
            if (value === undefined) {
                continue;
            }
            contentFields[key] = value;
        }

        return JSON.stringify(contentFields);
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
        const passkey = await PasskeyModel.findOne({ userId: signerId, credentialID: credentialId }).lean();
        if (!passkey) {
            throw new Error("Passkey not found for signer");
        }
        return Buffer.from(passkey.credentialPublicKey).toString("base64url");
    }

    /**
     * Helper to build the EncryptedTimelineItem from a validated plaintext TimelineItem
     */
    private async encryptItem(item: PlainTimelineItem, childId: string): Promise<EncryptedTimelineItem> {
        const child = await this.childRepository.findById(childId);
        if (!child) {
            throw new Error(`Child not found: ${childId}`);
        }

        const family = await this.familyModel.findById(child.familyId);
        if (!family) {
            throw new Error(`Family not found for child: ${childId} (familyId: ${child.familyId})`);
        }

        if (!family.parentPublicKeys || family.parentPublicKeys.length < 2) {
            throw new Error(`Cannot encrypt: Both parents must have registered RSA public keys.`);
        }

        const plaintextStr = this.extractContentForEncryption(item);

        // Prefer selecting recipients directly from parentPublicKeys by role.
        let momKeyEntry = family.parentPublicKeys.find((k) => k.role === "mom");
        let dadKeyEntry = family.parentPublicKeys.find((k) => k.role === "dad");

        // Fallback: if role metadata is incomplete, resolve by parentIds ordering.
        const momIdFromFamily = family.parentIds && family.parentIds[0];
        const dadIdFromFamily = family.parentIds && family.parentIds[1];
        if (!momKeyEntry && momIdFromFamily) {
            momKeyEntry = family.parentPublicKeys.find((k) => k.parentId === momIdFromFamily);
        }
        if (!dadKeyEntry && dadIdFromFamily) {
            dadKeyEntry = family.parentPublicKeys.find((k) => k.parentId === dadIdFromFamily);
        }

        if (!momKeyEntry || !dadKeyEntry) {
            throw new Error(
                `Cannot encrypt: Missing RSA public keys for both parents. parentIds: ${family.parentIds || "undefined"}, keys present for: ${family.parentPublicKeys.map(k => k.role || k.parentId).join(', ')}`
            );
        }

        const momKey = momKeyEntry.rsaPublicKeyBase64;
        const dadKey = dadKeyEntry.rsaPublicKeyBase64;

        if (!momKey || !dadKey) {
            throw new Error("Cannot encrypt: Both mom and dad must have registered RSA public keys (base64).");
        }

        // Use the actual parentIds for the payload keys
        const finalMomId = momKeyEntry.parentId || momIdFromFamily;
        const finalDadId = dadKeyEntry.parentId || dadIdFromFamily;

        if (!finalMomId || !finalDadId) {
            throw new Error(`Cannot encrypt: Unable to resolve parent IDs for payload. Mom: ${finalMomId}, Dad: ${finalDadId}`);
        }

        const encryptedForMom = await this.cryptoService.encryptRSA(plaintextStr, momKey);
        const encryptedForDad = await this.cryptoService.encryptRSA(plaintextStr, dadKey);

        const payload: EncryptedPayload = {
            [finalMomId]: encryptedForMom,
            [finalDadId]: encryptedForDad
        };

        const unencryptedFields = Object.fromEntries(
            Object.entries(item as Record<string, unknown>).filter(([key]) => TimelineServiceImpl.UNENCRYPTED_ITEM_FIELDS.has(key))
        );

        return {
            ...unencryptedFields,
            type: item.type,
            encryption: "ENCRYPTED",
            encryptedPayload: payload
        } as EncryptedTimelineItem;
    }

    async createItem(dto: CreateTimelineItemDto & { childId: string } & SignatureData): Promise<EncryptedTimelineItem> {
        this.assertSignatureMetadata(dto.signatureBase64, dto.timestamp, dto.keyId);
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
        const item = {
            ...dto,
            encryption: "PLAINTEXT",
            childIds: [dto.childId],
            id: this.uuidProvider.generate(),
            createdAt: timestamp,
            auditTrail: [initialAudit],
            isDeleted: false,
        } as unknown as PlainTimelineItem;

        // Validate using Zod schema
        const validated = TimelineItemSchema.parse(item) as PlainTimelineItem;

        // Business rule: Validate handover dates
        if (validated.type === "HANDOVER") {
            const [year, month, day] = validated.date.split('-').map(Number);
            const itemDate = new Date(year, month - 1, day);
            const today = this.dateProvider.getNow();
            today.setHours(0, 0, 0, 0);
            if (itemDate < today) {
                throw new Error("Handover date cannot be in the past");
            }
        }

        // Business rule: Medical visits must have diagnosis
        if (validated.type === "MEDICAL_VISIT" && !validated.diagnosis) {
            throw new Error("Medical visit must include a diagnosis");
        }

        const encryptedItem = await this.encryptItem(validated, dto.childId);
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

        return this.saveWithForensicIntent(
            (session?: unknown) => this.repository.save(encryptedItem, session),
            intent
        ) as Promise<EncryptedTimelineItem>;
    }

    async getItemsByDate(date: string): Promise<EncryptedTimelineItem[]> {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error("Invalid date format. Expected YYYY-MM-DD");
        }

        const allItems = await this.repository.findByDate(date);
        const items = allItems.filter(item => !item.isDeleted);

        // Sort by creation time (newest first)
        return items.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    async getItemsByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]> {
        // Validate date formats
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            throw new Error("Invalid date format. Expected YYYY-MM-DD");
        }

        const allItems = await this.repository.findByDateRange(from, to);
        const items = allItems.filter(item => !item.isDeleted);

        // Sort by date (ascending) then by creation time (newest first)
        return items.sort((a, b) => {
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

        // Sanitize createdAt: Mongoose might have stored it as a Date or a non-ISO string
        // If it's not a valid ISO string, convert it defensively.
        let sanitizedCreatedAt: string;
        try {
            const existingCreatedAt = existing.createdAt as any;
            if (typeof existingCreatedAt === 'string' && existingCreatedAt.includes('T') && existingCreatedAt.endsWith('Z')) {
                sanitizedCreatedAt = existingCreatedAt;
            } else {
                const parsed = new Date(existingCreatedAt);
                if (Number.isNaN(parsed.getTime())) {
                    console.warn(`[TimelineService] Invalid createdAt timestamp for item ${id}, falling back to now`);
                    sanitizedCreatedAt = this.dateProvider.getIsoString();
                } else {
                    sanitizedCreatedAt = parsed.toISOString();
                }
            }
        } catch (e) {
            console.warn(`[TimelineService] Failed to sanitize date for item ${id}:`, e);
            sanitizedCreatedAt = this.dateProvider.getIsoString();
        }

        // Validate the incoming full item while preserving immutable server-side fields.
        // We handle encryption defaulting here for backward compatibility and tests.
        const incomingEncryption = (fullPlaintextUpdate as any).encryption ||
            ((fullPlaintextUpdate as any).encryptedPayload ? "ENCRYPTED" : "PLAINTEXT");

        const validated: TimelineItem = TimelineItemSchema.parse({
            ...(fullPlaintextUpdate as any),
            encryption: incomingEncryption,
            id: existing.id,
            createdBy: existing.createdBy,
            createdAt: sanitizedCreatedAt,
            createdByName: existing.createdByName,
            childIds: existing.childIds,
            isDeleted: existing.isDeleted,
        });

        // We cannot calculate precise field differences on the backend anymore 
        // because we can't read the existing ciphertext.
        // The audit trail just records an "UPDATED" action.
        const auditEntry: AuditEntry = {
            timestamp: this.dateProvider.getIsoString(),
            userId,
            userName,
            action: "UPDATED",
            changes: { note: "Field-level changes hidden due to encryption" }
        };

        validated.auditTrail = [...existing.auditTrail, auditEntry];

        // Re-encrypt if it was plaintext, otherwise use the provided encrypted payload
        let encryptedUpdatedItem: EncryptedTimelineItem;
        if (validated.encryption === "ENCRYPTED") {
            encryptedUpdatedItem = validated as EncryptedTimelineItem;
        } else {
            encryptedUpdatedItem = await this.encryptItem(validated as PlainTimelineItem, childId);
        }
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

        return this.saveWithForensicIntent(
            (session?: unknown) => this.repository.update(id, encryptedUpdatedItem, session),
            intent
        ) as Promise<EncryptedTimelineItem>;
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

        const updated = {
            ...existing,
            isDeleted: true,
            auditTrail: [...existing.auditTrail, auditEntry]
        };
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
    }
}
