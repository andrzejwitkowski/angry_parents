import type { TimelineRepository } from "../../core/ports/TimelineRepository";
import type { EncryptedTimelineItem, TimelineItem } from "../../core/domain/TimelineItem";

/**
 * In-Memory Database for Timeline Items
 * Uses a Map to simulate database storage.
 * Key: ISO date string (YYYY-MM-DD)
 * Value: Array of timeline items for that date
 *
 * This implementation is ready for migration to MongoDB/PostgreSQL.
 */
export class InMemoryTimelineRepository implements TimelineRepository {
    private itemsByDate: Map<string, EncryptedTimelineItem[]> = new Map();
    private itemsById: Map<string, EncryptedTimelineItem> = new Map();

    async save(item: EncryptedTimelineItem, _session?: unknown): Promise<EncryptedTimelineItem> {
        // Store by date
        const dateKey = item.date;
        const existingItems = this.itemsByDate.get(dateKey) || [];
        existingItems.push(item);
        this.itemsByDate.set(dateKey, existingItems);

        // Store by ID for quick lookup
        this.itemsById.set(item.id, item);

        return item;
    }

    async findByDate(date: string): Promise<EncryptedTimelineItem[]> {
        return this.itemsByDate.get(date) || [];
    }

    async findByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]> {
        const results: EncryptedTimelineItem[] = [];
        for (const [date, items] of this.itemsByDate.entries()) {
            if (date >= from && date <= to) {
                results.push(...items);
            }
        }
        return results;
    }

    async findById(id: string): Promise<EncryptedTimelineItem | null> {
        return this.itemsById.get(id) || null;
    }

    async update(id: string, updates: Partial<EncryptedTimelineItem>, _session?: unknown): Promise<EncryptedTimelineItem> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            throw new Error(`Item with id ${id} not found`);
        }

        const updatedItem = { ...existingItem, ...updates } as EncryptedTimelineItem;

        // Update in both maps
        this.itemsById.set(id, updatedItem);

        // Update in date-based storage, including date re-indexing if date changed
        const oldDateKey = existingItem.date;
        const newDateKey = updatedItem.date;
        const oldItems = this.itemsByDate.get(oldDateKey) || [];
        const index = oldItems.findIndex((item) => item.id === id);
        if (index !== -1) {
            oldItems.splice(index, 1);
            this.itemsByDate.set(oldDateKey, oldItems);
        }

        const newItems = this.itemsByDate.get(newDateKey) || [];
        newItems.push(updatedItem);
        this.itemsByDate.set(newDateKey, newItems);
        if (oldDateKey !== newDateKey && oldItems.length === 0) {
            this.itemsByDate.delete(oldDateKey);
        }

        return updatedItem;
    }

    async delete(id: string, _session?: unknown): Promise<void> {
        const item = this.itemsById.get(id);
        if (!item) {
            throw new Error(`Item with id ${id} not found`);
        }

        this.itemsById.delete(id);

        const dateKey = item.date;
        const items = this.itemsByDate.get(dateKey) || [];
        const filtered = items.filter((i) => i.id !== id);
        this.itemsByDate.set(dateKey, filtered);
    }

    async countByChildId(childId: string): Promise<number> {
        let count = 0;
        for (const item of this.itemsById.values()) {
            if (item.childIds?.includes(childId)) {
                count++;
            }
        }
        return count;
    }

    async withTransaction<T>(operation: (session?: unknown) => Promise<T>): Promise<T> {
        return operation(undefined);
    }

    // --- Helper methods for testing ---

    /**
     * Clear all data
     */
    clear(): void {
        this.itemsByDate.clear();
        this.itemsById.clear();
    }

    /**
     * Get all raw data (for assertions)
     */
    getAllData(): EncryptedTimelineItem[] {
        return Array.from(this.itemsById.values());
    }
}
