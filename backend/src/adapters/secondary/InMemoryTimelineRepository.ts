import type { TimelineRepository } from "../../core/ports/TimelineRepository";
import type { TimelineItem } from "../../core/domain/TimelineItem";

/**
 * In-Memory Timeline Repository
 * Uses a Map to simulate database storage.
 * Key: ISO date string (YYYY-MM-DD)
 * Value: Array of timeline items for that date
 * 
 * This implementation is ready for migration to MongoDB/PostgreSQL.
 */
export class InMemoryTimelineRepository implements TimelineRepository {
    private storage: Map<string, TimelineItem[]> = new Map();
    private itemsById: Map<string, TimelineItem> = new Map();

    async save(item: TimelineItem): Promise<TimelineItem> {
        // Store by date
        const dateKey = item.date;
        const existingItems = this.storage.get(dateKey) || [];
        existingItems.push(item);
        this.storage.set(dateKey, existingItems);

        // Store by ID for quick lookup
        this.itemsById.set(item.id, item);

        return item;
    }

    async findByDate(date: string): Promise<TimelineItem[]> {
        return this.storage.get(date) || [];
    }

    async findByDateRange(from: string, to: string): Promise<TimelineItem[]> {
        const results: TimelineItem[] = [];
        for (const [date, items] of this.storage.entries()) {
            if (date >= from && date <= to) {
                results.push(...items);
            }
        }
        return results;
    }

    async findById(id: string): Promise<TimelineItem | null> {
        return this.itemsById.get(id) || null;
    }

    async update(id: string, updates: Partial<TimelineItem>): Promise<TimelineItem> {
        const existing = this.itemsById.get(id);
        if (!existing) {
            throw new Error(`Item with id ${id} not found`);
        }

        const updated = { ...existing, ...updates } as TimelineItem;

        // Update in both maps
        this.itemsById.set(id, updated);

        // Update in date-based storage
        const dateKey = existing.date;
        const items = this.storage.get(dateKey) || [];
        const index = items.findIndex((item) => item.id === id);
        if (index !== -1) {
            items[index] = updated;
            this.storage.set(dateKey, items);
        }

        return updated;
    }

    async delete(id: string): Promise<void> {
        const existing = this.itemsById.get(id);
        if (!existing) {
            throw new Error(`Item with id ${id} not found`);
        }

        // Remove from ID map
        this.itemsById.delete(id);

        // Remove from date-based storage
        const dateKey = existing.date;
        const items = this.storage.get(dateKey) || [];
        const filtered = items.filter((item) => item.id !== id);

        if (filtered.length === 0) {
            this.storage.delete(dateKey);
        } else {
            this.storage.set(dateKey, filtered);
        }
    }

    /**
     * Utility method for testing - clears all data
     */
    clear(): void {
        this.storage.clear();
        this.itemsById.clear();
    }

    /**
     * Utility method for testing - get all items
     */
    getAllItems(): TimelineItem[] {
        return Array.from(this.itemsById.values());
    }
}
