import type { TimelineItem, CreateTimelineItemDto, EncryptedTimelineItem, EventProofRecord } from "../model/TimelineItem";

/**
 * Repository Port (Interface)
 * Defines the contract for timeline data persistence.
 * Implementations can be in-memory, MongoDB, PostgreSQL, etc.
 */
export interface TimelineRepository {
    /**
     * Save a new timeline item (with encrypted content)
     */
    save(item: EncryptedTimelineItem, session?: unknown): Promise<EncryptedTimelineItem>;

    /**
     * Find all timeline items for a specific date
     * @param date - ISO date string (YYYY-MM-DD)
     */
    findByDate(date: string): Promise<EncryptedTimelineItem[]>;

    /**
     * Find timeline items within a date range
     * @param from - Start date (YYYY-MM-DD)
     * @param to - End date (YYYY-MM-DD)
     */
    findByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]>;

    /**
     * Find a single timeline item by ID
     */
    findById(id: string): Promise<EncryptedTimelineItem | null>;

    /**
     * Find a timeline item by ID including deleted items.
     */
    findByIdIncludingDeleted(id: string): Promise<EncryptedTimelineItem | null>;

    /**
     * Update an existing timeline item (with encrypted content)
     */
    update(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem>;

    /**
     * Update an existing timeline item including soft-deleted records.
     */
    updateIncludingDeleted(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem>;

    /**
     * Delete a timeline item
     */
    delete(id: string, session?: unknown): Promise<void>;

    /**
     * Append blockchain proof metadata to a stored event version.
     */
    appendProofRecord(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem>;

    /**
     * Persist submitted transaction metadata before final confirmation.
     */
    markProofSubmitted(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem>;

    /**
     * Atomically confirm a pending proof only if no confirmation exists yet for that version.
     */
    confirmProofAtomically(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem | null>;

    /**
     * Atomically claim a pending proof transition before attempting blockchain submission.
     */
    markProofTransitionInProgress(id: string, version: number, hash: string, session?: unknown): Promise<EncryptedTimelineItem | null>;

    /**
     * Roll back an in-progress claim when submission fails before any tx hash is persisted.
     */
    resetProofTransitionClaim(id: string, version: number, hash: string, session?: unknown): Promise<EncryptedTimelineItem | null>;

    /**
     * Replace the latest proof record for a version/hash with a recovered state after infrastructure failure.
     */
    replaceProofRecord(id: string, proof: EventProofRecord, session?: unknown): Promise<EncryptedTimelineItem>;

    withTransaction<T>(operation: (session?: unknown) => Promise<T>): Promise<T>;

    /**
     * Count items associated with a specific child
     */
    countByChildId(childId: string): Promise<number>;
}

/**
 * Service Port (Interface)
 * Defines the contract for timeline business logic.
 */
export interface TimelineService {
    /**
     * Create a new timeline item with validation
     */
    createItem(dto: CreateTimelineItemDto): Promise<TimelineItem>;

    /**
     * Get all items for a specific date
     */
    getItemsByDate(date: string): Promise<TimelineItem[]>;

    /**
     * Get items within a date range
     */
    getItemsByDateRange(from: string, to: string): Promise<TimelineItem[]>;

    /**
     * Update a timeline item (e.g., toggle medication checkbox)
     * Only the creator can update their own items
     */
    updateItem(id: string, updates: Partial<TimelineItem>, userId: string, userName?: string): Promise<TimelineItem>;

    /**
     * Delete a timeline item
     * Only the creator can delete their own items
     */
    deleteItem(id: string, userId: string, userName?: string): Promise<void>;
}
