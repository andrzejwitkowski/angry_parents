import type { TimelineItem, CreateTimelineItemDto } from "../domain/TimelineItem";

/**
 * Repository Port (Interface)
 * Defines the contract for timeline data persistence.
 * Implementations can be in-memory, MongoDB, PostgreSQL, etc.
 */
export interface TimelineRepository {
    /**
     * Save a new timeline item
     */
    save(item: TimelineItem): Promise<TimelineItem>;

    /**
     * Find all timeline items for a specific date
     * @param date - ISO date string (YYYY-MM-DD)
     */
    findByDate(date: string): Promise<TimelineItem[]>;

    /**
     * Find timeline items within a date range
     * @param from - Start date (YYYY-MM-DD)
     * @param to - End date (YYYY-MM-DD)
     */
    findByDateRange(from: string, to: string): Promise<TimelineItem[]>;

    /**
     * Find a single timeline item by ID
     */
    findById(id: string): Promise<TimelineItem | null>;

    /**
     * Update an existing timeline item
     */
    update(id: string, updates: Partial<TimelineItem>): Promise<TimelineItem>;

    /**
     * Delete a timeline item
     */
    delete(id: string): Promise<void>;
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
    updateItem(id: string, updates: Partial<TimelineItem>, userId: string): Promise<TimelineItem>;

    /**
     * Delete a timeline item
     * Only the creator can delete their own items
     */
    deleteItem(id: string, userId: string): Promise<void>;
}
