import type { TimelineRepository } from "../../../../domain/events/ports/TimelineRepository";
import { normalizeTimelineItemProofHistory, type EncryptedTimelineItem, type EventProofRecord } from "../../../../domain/events/model/TimelineItem";

export class InMemoryTimelineRepository implements TimelineRepository {
    private itemsByDate: Map<string, EncryptedTimelineItem[]> = new Map();
    private itemsById: Map<string, EncryptedTimelineItem> = new Map();

    private toDomainItem(item: EncryptedTimelineItem): EncryptedTimelineItem {
        return normalizeTimelineItemProofHistory(structuredClone(item));
    }

    async save(item: EncryptedTimelineItem, _session?: unknown): Promise<EncryptedTimelineItem> {
        const dateKey = item.date;
        const existingItems = this.itemsByDate.get(dateKey) || [];
        const storedItem = structuredClone(item);
        existingItems.push(storedItem);
        this.itemsByDate.set(dateKey, existingItems);
        this.itemsById.set(item.id, storedItem);
        return this.toDomainItem(storedItem);
    }

    async findByDate(date: string): Promise<EncryptedTimelineItem[]> {
        return (this.itemsByDate.get(date) || []).map((item) => this.toDomainItem(item));
    }

    async findByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]> {
        const results: EncryptedTimelineItem[] = [];
        for (const [date, items] of this.itemsByDate.entries()) {
            if (date >= from && date <= to) {
                results.push(...items);
            }
        }
        return results.map((item) => this.toDomainItem(item));
    }

    async findById(id: string): Promise<EncryptedTimelineItem | null> {
        const item = this.itemsById.get(id) || null;
        return item && !item.isDeleted ? this.toDomainItem(item) : null;
    }

    async findByIdIncludingDeleted(id: string): Promise<EncryptedTimelineItem | null> {
        const item = this.itemsById.get(id) || null;
        return item ? this.toDomainItem(item) : null;
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

        return this.toDomainItem(updatedItem);
    }

    async updateIncludingDeleted(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem> {
        return this.update(id, updates, session);
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

        return this.toDomainItem(updatedItem);
    }

    async markProofSubmitted(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem> {
        return this.appendProofRecord(id, proof, session);
    }

    async confirmProofAtomically(id: string, proof: EventProofRecord, _session?: unknown): Promise<EncryptedTimelineItem | null> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            return null;
        }

        let didConfirm = false;
        const versionHistory = existingItem.versionHistory.map((entry) => {
            if (entry.version !== proof.version) {
                return entry;
            }

            const hasConfirmedProof = entry.proofHistory.some((existingProof) => existingProof.status === "CONFIRMED");
            if (hasConfirmedProof) {
                return entry;
            }

            const proofIndex = entry.proofHistory.findIndex((existingProof) => existingProof.hash === proof.hash);
            if (proofIndex === -1) {
                return entry;
            }

            const currentProof = entry.proofHistory[proofIndex];
            if (currentProof.status !== "SUBMITTED" && currentProof.status !== "RECONCILING") {
                return entry;
            }

            didConfirm = true;
            const updatedProofHistory = [...entry.proofHistory];
            updatedProofHistory[proofIndex] = {
                ...currentProof,
                ...proof,
                status: "CONFIRMED",
            };

            return {
                ...entry,
                proofHistory: updatedProofHistory,
            };
        });

        if (!didConfirm) {
            return null;
        }

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

        return this.toDomainItem(updatedItem);
    }

    async markProofTransitionInProgress(id: string, version: number, hash: string, _session?: unknown): Promise<EncryptedTimelineItem | null> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            return null;
        }

        let didClaim = false;
        const versionHistory = existingItem.versionHistory.map((entry) => {
            if (entry.version !== version) {
                return entry;
            }

            const proofIndex = entry.proofHistory.findIndex((proof) => proof.hash === hash);
            if (proofIndex === -1) {
                return entry;
            }

            const proof = entry.proofHistory[proofIndex];
            if (proof.status !== "CLAIMED") {
                return entry;
            }

            didClaim = true;
            const updatedProofHistory = [...entry.proofHistory];
            updatedProofHistory[proofIndex] = {
                ...proof,
                status: "RECONCILING",
            };

            return {
                ...entry,
                proofHistory: updatedProofHistory,
            };
        });

        if (!didClaim) {
            return null;
        }

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

        return this.toDomainItem(updatedItem);
    }

    async resetProofTransitionClaim(id: string, version: number, hash: string, _session?: unknown): Promise<EncryptedTimelineItem | null> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            return null;
        }

        let didReset = false;
        const versionHistory = existingItem.versionHistory.map((entry) => {
            if (entry.version !== version) {
                return entry;
            }

            const proofIndex = entry.proofHistory.findIndex((proof) => proof.hash === hash);
            if (proofIndex === -1) {
                return entry;
            }

            const proof = entry.proofHistory[proofIndex];
            if (proof.status !== "RECONCILING") {
                return entry;
            }

            didReset = true;
            const updatedProofHistory = [...entry.proofHistory];
            updatedProofHistory[proofIndex] = {
                ...proof,
                status: "CLAIMED",
            };

            return {
                ...entry,
                proofHistory: updatedProofHistory,
            };
        });

        if (!didReset) {
            return null;
        }

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

        return this.toDomainItem(updatedItem);
    }

    async replaceProofRecord(id: string, proof: EventProofRecord, _session?: unknown): Promise<EncryptedTimelineItem> {
        const existingItem = this.itemsById.get(id);
        if (!existingItem) {
            throw new Error(`Item with id ${id} not found`);
        }

        let didReplace = false;
        const versionHistory = existingItem.versionHistory.map((entry) => {
            if (entry.version !== proof.version) {
                return entry;
            }

            const proofIndex = entry.proofHistory.findIndex((existingProof) => existingProof.hash === proof.hash);
            if (proofIndex === -1) {
                throw new Error(`Item with id ${id} and version ${proof.version} not found`);
            }

            didReplace = true;
            const updatedProofHistory = [...entry.proofHistory];
            updatedProofHistory[proofIndex] = proof;

            return {
                ...entry,
                proofHistory: updatedProofHistory,
            };
        });

        if (!didReplace) {
            throw new Error(`Item with id ${id} and version ${proof.version} not found`);
        }

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

        return this.toDomainItem(updatedItem);
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
