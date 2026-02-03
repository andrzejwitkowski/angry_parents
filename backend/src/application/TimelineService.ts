import type { TimelineRepository } from "../core/ports/TimelineRepository";
import type { TimelineItem, CreateTimelineItemDto, AuditEntry } from "../core/domain/TimelineItem";
import { TimelineItemSchema } from "../core/domain/TimelineItem";

/**
 * TimelineService Implementation
 * Contains business logic for timeline operations.
 * Follows Hexagonal Architecture - depends only on ports, not adapters.
 */
export class TimelineServiceImpl {
    constructor(private readonly repository: TimelineRepository) { }

    async createItem(dto: CreateTimelineItemDto): Promise<TimelineItem> {
        const timestamp = new Date().toISOString();

        // Initial audit entry
        const initialAudit: AuditEntry = {
            timestamp,
            userId: dto.createdBy,
            userName: dto.createdByName,
            action: "CREATED",
        };

        // Generate ID and timestamp
        const item: TimelineItem = {
            ...dto,
            id: crypto.randomUUID(),
            createdAt: timestamp,
            auditTrail: [initialAudit],
            isDeleted: false,
        } as TimelineItem;

        // Validate using Zod schema
        const validated = TimelineItemSchema.parse(item);

        // Business rule: Validate handover dates
        if (validated.type === "HANDOVER") {
            const itemDate = new Date(validated.date);
            if (itemDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                throw new Error("Handover date cannot be in the past");
            }
        }

        // Business rule: Medical visits must have diagnosis
        if (validated.type === "MEDICAL_VISIT" && !validated.diagnosis) {
            throw new Error("Medical visit must include a diagnosis");
        }

        return this.repository.save(validated);
    }

    async getItemsByDate(date: string): Promise<TimelineItem[]> {
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

    async getItemsByDateRange(from: string, to: string): Promise<TimelineItem[]> {
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

    async updateItem(id: string, updates: Partial<TimelineItem>, userId: string, userName?: string): Promise<TimelineItem> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Authorization check: only the creator can update
        if (existing.createdBy !== userId) {
            throw new Error("Unauthorized: You can only modify your own items");
        }

        // Calculate changes for audit trail
        const changes: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (JSON.stringify((existing as any)[key]) !== JSON.stringify(value)) {
                changes[key] = value;
            }
        }

        if (Object.keys(changes).length === 0) {
            return existing;
        }

        const auditEntry: AuditEntry = {
            timestamp: new Date().toISOString(),
            userId,
            userName,
            action: "UPDATED",
            changes,
        };

        // Merge updates with existing item
        const updated = {
            ...existing,
            ...updates,
            auditTrail: [...existing.auditTrail, auditEntry]
        };

        // Validate the merged result
        const validated = TimelineItemSchema.parse(updated);

        return this.repository.update(id, validated);
    }

    async deleteItem(id: string, userId: string, userName?: string): Promise<void> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Authorization check: only the creator can delete
        if (existing.createdBy !== userId) {
            throw new Error("Unauthorized: You can only delete your own items");
        }

        const auditEntry: AuditEntry = {
            timestamp: new Date().toISOString(),
            userId,
            userName,
            action: "DELETED",
        };

        const updated = {
            ...existing,
            isDeleted: true,
            auditTrail: [...existing.auditTrail, auditEntry]
        };

        await this.repository.update(id, updated);
    }
}
