import type { TimelineRepository } from "../../../../domain/events/ports/TimelineRepository";
import type { EncryptedTimelineItem, EventProofRecord } from "../../../../domain/events/model/TimelineItem";

export class InMemoryTimelineRepository implements TimelineRepository {
    private itemsByDate: Map<string, EncryptedTimelineItem[]> = new Map();
    private itemsById: Map<string, EncryptedTimelineItem> = new Map();

    async save(item: EncryptedTimelineItem, _session?: unknown): Promise<EncryptedTimelineItem> {
        const dateKey = item.date;
        const existingItems = this.itemsByDate.get(dateKey) || [];
        existingItems.push(item);
        this.itemsByDate.set(dateKey, existingItems);
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
        const item = this.itemsById.get(id) || null;
        return item && !item.isDeleted ? item : null;
    }

    async findByIdIncludingDeleted(id: string): Promise<EncryptedTimelineItem | null> {
        return this.itemsById.get(id) || null;
    }

    async update(id: string, updates: Partial<EncryptedTimelineItem>, _session?: unknown): Promise<EncryptedTimelineItem> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            throw new Error(`Item with id ${id} not found`);
        }

        const updatedItem = { ...existingItem, ...updates } as EncryptedTimelineItem;
        this.itemsById.set(id, updatedItem);

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

    async appendProofRecord(id: string, proof: EventProofRecord, _session?: unknown): Promise<EncryptedTimelineItem> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            throw new Error(`Item with id ${id} not found`);
        }

        const hasMatchingVersion = existingItem.versionHistory.some((entry) => entry.version === proof.version);
        if (!hasMatchingVersion) {
            throw new Error(`Item with id ${id} and version ${proof.version} not found`);
        }

        const versionHistory = existingItem.versionHistory.map((entry) => {
            if (entry.version !== proof.version) {
                return entry;
            }

            const existingProofIndex = entry.proofHistory.findIndex((existingProof) => existingProof.hash === proof.hash);
            if (existingProofIndex !== -1) {
                const mergedProofHistory = [...entry.proofHistory];
                mergedProofHistory[existingProofIndex] = {
                    ...mergedProofHistory[existingProofIndex],
                    ...proof,
                };

                return {
                    ...entry,
                    proofHistory: mergedProofHistory,
                };
            }

            return {
                ...entry,
                proofHistory: [...entry.proofHistory, proof],
            };
        });

        const updatedItem = {
            ...existingItem,
            versionHistory,
        } satisfies EncryptedTimelineItem;

        this.itemsById.set(id, updatedItem);

        const itemsForDate = this.itemsByDate.get(existingItem.date) || [];
        const itemIndex = itemsForDate.findIndex((item) => item.id === id);
        if (itemIndex !== -1) {
            itemsForDate[itemIndex] = updatedItem;
            this.itemsByDate.set(existingItem.date, itemsForDate);
        }

        return updatedItem;
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

    clear(): void {
        this.itemsByDate.clear();
        this.itemsById.clear();
    }

    getAllData(): EncryptedTimelineItem[] {
        return Array.from(this.itemsById.values());
    }
}
