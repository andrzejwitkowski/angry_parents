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

/**
 * TimelineService Implementation
 * Contains business logic for timeline operations.
 * Follows Hexagonal Architecture - depends only on ports, not adapters.
 */
export class TimelineServiceImpl {
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
        // We know these fields are the ones we want to encrypt based on EncryptedTimelineItem type
        const contentFields = {
            notes: (item as any).notes,
            doctor: (item as any).doctor,
            treatment: (item as any).treatment,
            diagnosis: (item as any).diagnosis,
            medicineName: (item as any).medicineName,
            dosage: (item as any).dosage,
            unit: (item as any).unit,
            frequency: (item as any).frequency,
            durationDays: (item as any).durationDays,
            description: (item as any).description,
            severity: (item as any).severity,
            category: (item as any).category,
            handoverNotes: (item as any).handoverNotes,
            destination: (item as any).destination,
            url: (item as any).url,
            fileType: (item as any).fileType,
            metadata: (item as any).metadata,
            content: (item as any).content,
        };
        // Remove undefined fields to save space
        const cleanFields = Object.fromEntries(Object.entries(contentFields).filter(([_, v]) => v !== undefined));
        return JSON.stringify(cleanFields);
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

        const momKey = family.parentPublicKeys[0].rsaPublicKeyBase64;
        const dadKey = family.parentPublicKeys[1].rsaPublicKeyBase64; // Assuming 2 parents

        const encryptedForMom = await this.cryptoService.encryptRSA(plaintextStr, momKey);
        const encryptedForDad = await this.cryptoService.encryptRSA(plaintextStr, dadKey);

        const payload: EncryptedPayload = { encryptedForMom, encryptedForDad };

        const {
            notes, doctor, treatment, diagnosis, medicineName, dosage, unit, frequency,
            durationDays, description, severity, category, handoverNotes, destination,
            url, fileType, metadata, content, ...unencryptedFields
        } = item as any;

        return {
            ...unencryptedFields,
            encryptedPayload: payload
        } as EncryptedTimelineItem;
    }

    async createItem(dto: CreateTimelineItemDto & { childId: string, signatureBase64: string, timestamp: string, keyId: string }): Promise<EncryptedTimelineItem> {
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
            childIds: dto.childId ? [dto.childId] : (dto as unknown as Record<string, unknown>).childIds as string[] || [],
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

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the encrypted item
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            encryptedItem,
            "user-public-key-placeholder", // We don't need actual user pub key for createPending (we only verify later)
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
        signatureBase64: string,
        timestamp: string,
        keyId: string,
        userName?: string
    ): Promise<EncryptedTimelineItem> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Authorization check: only the creator can update
        if (existing.createdBy !== userId) {
            throw new Error("Unauthorized: You can only modify your own items");
        }

        // Validate the incoming full item
        const validated = TimelineItemSchema.parse(fullPlaintextUpdate);

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

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the updated encrypted item
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            encryptedUpdatedItem,
            "user-public-key-placeholder",
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
        signatureBase64: string,
        timestamp: string,
        keyId: string,
        userName?: string
    ): Promise<void> {
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

        // --- Forensic Integration ---
        // Create a pending forensic document wrapping the deleted status
        await this.forensicService.createPendingDocument<EncryptedTimelineItem>(
            updated as EncryptedTimelineItem,
            "user-public-key-placeholder",
            signatureBase64,
            keyId,
            timestamp,
            userId
        );

        await this.repository.update(id, updated as EncryptedTimelineItem);
    }
}
