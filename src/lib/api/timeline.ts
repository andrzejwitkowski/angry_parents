import type { TimelineItem, CreateTimelineItemDto } from "@/types/timeline.types";

const API_BASE_URL = "http://localhost:3000/api";

class TimelineApiError extends Error {
    public status?: number;

    constructor(
        message: string,
        status?: number
    ) {
        super(message);
        this.status = status;
        this.name = "TimelineApiError";
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TimelineApiError(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status
        );
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}

export const timelineApi = {
    async getByDate(date: string): Promise<TimelineItem[]> {
        const response = await fetch(`${API_BASE_URL}/calendar/${date}/timeline`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        const data = await handleResponse<{ items: TimelineItem[] }>(response);
        return data.items;
    },

    /**
     * Get all timeline items within a date range
     */
    async getByDateRange(from: string, to: string): Promise<TimelineItem[]> {
        const response = await fetch(`${API_BASE_URL}/timeline/range?from=${from}&to=${to}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        const data = await handleResponse<{ items: TimelineItem[] }>(response);
        return data.items;
    },

    /**
     * Create a new timeline item
     */
    async create(dto: CreateTimelineItemDto): Promise<TimelineItem> {
        const response = await fetch(`${API_BASE_URL}/timeline`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(dto),
        });

        return handleResponse<TimelineItem>(response);
    },

    /**
     * Update an existing timeline item
     */
    async update(id: string, updates: Partial<TimelineItem>): Promise<TimelineItem> {
        const response = await fetch(`${API_BASE_URL}/timeline/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(updates),
        });

        return handleResponse<TimelineItem>(response);
    },

    /**
     * Delete a timeline item
     */
    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/timeline/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        return handleResponse<void>(response);
    },
};
