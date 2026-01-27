import type { TimelineRepository } from "../core/ports/TimelineRepository";
import type { TimelineItem, CreateTimelineItemDto } from "../core/domain/TimelineItem";
import { TimelineItemSchema } from "../core/domain/TimelineItem";

/**
 * TimelineService Implementation
 * Contains business logic for timeline operations.
 * Follows Hexagonal Architecture - depends only on ports, not adapters.
 */
export class TimelineServiceImpl {
    constructor(private readonly repository: TimelineRepository) { }

    async createItem(dto: CreateTimelineItemDto): Promise<TimelineItem> {
        // Generate ID and timestamp
        const item: TimelineItem = {
            ...dto,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
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

        const items = await this.repository.findByDate(date);

        // Sort by creation time (newest first)
        return items.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    async updateItem(id: string, updates: Partial<TimelineItem>): Promise<TimelineItem> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        // Merge updates with existing item
        const updated = { ...existing, ...updates };

        // Validate the merged result
        const validated = TimelineItemSchema.parse(updated);

        return this.repository.update(id, validated);
    }

    async deleteItem(id: string): Promise<void> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error(`Timeline item with id ${id} not found`);
        }

        await this.repository.delete(id);
    }
}
