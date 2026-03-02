import type { TimelineRepository } from "../core/ports/TimelineRepository";
import type { ChildRepository } from "../core/ports/ChildRepository";
import type { TimelineItem, CreateTimelineItemDto, AuditEntry, EncryptedTimelineItem, EncryptedPayload } from "../core/domain/TimelineItem";
import { TimelineItemSchema } from "../core/domain/TimelineItem";
import { DateProvider } from "../core/ports/DateProvider";
import { UuidProvider } from "../core/ports/UuidProvider";
import type { ICryptoService } from "../core/ports/ICryptoService";
import type { Model } from "mongoose";
import type { IFamily } from "../models/Family";
import type { ForensicService } from "./ForensicService";
import { PasskeyModel } from "../models/Passkey";

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
    ]);

    constructor(
        private readonly repository: TimelineRepository,
        private readonly dateProvider: DateProvider,
        private readonly uuidProvider: UuidProvider,
        private readonly cryptoService: ICryptoService,
        private readonly familyModel: Model<IFamily>,
        private readonly forensicService: ForensicService,
        private readonly childRepository: ChildRepository
    ) { }

    /**
     * Helper to extract content fields from a TimelineItem for encryption.
     * Returns a JSON string of all sensitive fields.
     */
    private extractContentForEncryption(item: TimelineItem): string {
        const contentFields = Object.fromEntries(
            Object.entries(item as Record<string, unknown>).filter(
                ([key, value]) => !TimelineServiceImpl.UNENCRYPTED_ITEM_FIELDS.has(key) && value !== undefined
            )
        );
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
    private async encryptItem(item: TimelineItem, childId: string): Promise<EncryptedTimelineItem> {
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

        const momKeyEntry = family.parentPublicKeys.find(p => p.role === "mom");
        const dadKeyEntry = family.parentPublicKeys.find(p => p.role === "dad");

        if (!momKeyEntry?.rsaPublicKeyBase64 || !dadKeyEntry?.rsaPublicKeyBase64) {
            throw new Error("Cannot encrypt: Both mom and dad must have registered RSA public keys.");
        }

        const momKey = momKeyEntry.rsaPublicKeyBase64;
        const dadKey = dadKeyEntry.rsaPublicKeyBase64;

        const encryptedForMom = await this.cryptoService.encryptRSA(plaintextStr, momKey);
        const encryptedForDad = await this.cryptoService.encryptRSA(plaintextStr, dadKey);

        const payload: EncryptedPayload = { encryptedForMom, encryptedForDad };

        const unencryptedFields = Object.fromEntries(
            Object.entries(item as Record<string, unknown>).filter(([key]) => TimelineServiceImpl.UNENCRYPTED_ITEM_FIELDS.has(key))
        );

        return {
            ...unencryptedFields,
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
        const item: TimelineItem = {
            ...dto,
            childIds: [dto.childId],
            id: this.uuidProvider.generate(),
            createdAt: timestamp,
            auditTrail: [initialAudit],
            isDeleted: false,
        } as unknown as TimelineItem;

        // Validate using Zod schema
        const validated = TimelineItemSchema.parse(item);

        // Business rule: Validate handover dates
        if (validated.type === "HANDOVER") {
            const itemDate = new Date(validated.date);
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

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the encrypted item
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            encryptedItem,
            signerPublicKey,
            dto.signatureBase64,
            dto.keyId,
            dto.timestamp,
            dto.createdBy
        );

        return this.repository.save(encryptedItem);
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

        // Validate the incoming full item while preserving immutable server-side fields.
        const validated = TimelineItemSchema.parse({
            ...fullPlaintextUpdate,
            id: existing.id,
            createdBy: existing.createdBy,
            createdAt: existing.createdAt,
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

        // Re-encrypt the full item
        const encryptedUpdatedItem = await this.encryptItem(validated, childId);
        const signerPublicKey = await this.resolveSignerPublicKey(userId, keyId);

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the updated encrypted item
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            encryptedUpdatedItem,
            signerPublicKey,
            signatureBase64,
            keyId,
            timestamp,
            userId
        );

        return this.repository.update(id, encryptedUpdatedItem);
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

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the deleted status
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            updated as EncryptedTimelineItem,
            signerPublicKey,
            signatureBase64,
            keyId,
            timestamp,
            userId
        );

        await this.repository.update(id, updated as EncryptedTimelineItem);
    }
}
