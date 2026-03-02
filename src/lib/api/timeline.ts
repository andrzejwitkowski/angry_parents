import type { TimelineItem, CreateTimelineItemDto } from "@/types/timeline.types";
import { decryptRSA, importPrivateKey } from "@/lib/crypto-utils";
import { DEV_RSA_PRIVATE_KEY } from "@/lib/mocks/cryptoMock";

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

let cachedPrivateKey: CryptoKey | null = null;

async function decryptTimelineItems(items: TimelineItem[]): Promise<TimelineItem[]> {
    const privateKeyBase64 = import.meta.env.VITE_DEV_RSA_PRIVATE_KEY || DEV_RSA_PRIVATE_KEY;
    if (!privateKeyBase64) return items;

    if (!cachedPrivateKey) {
        cachedPrivateKey = await importPrivateKey(privateKeyBase64);
    }

    return Promise.all(items.map(async (item) => {
        if (!item.encryptedPayload) return item;

        const ciphertext = typeof item.encryptedPayload === "string"
            ? item.encryptedPayload
            : item.encryptedPayload.encryptedForMom || item.encryptedPayload.encryptedForDad;

        if (!ciphertext) return item;

        try {
            const decrypted = await decryptRSA(ciphertext, cachedPrivateKey as CryptoKey);
            const decryptedFields = JSON.parse(decrypted) as Record<string, unknown>;
            const { encryptedPayload, ...base } = item;
            return {
                ...base,
                ...decryptedFields
            } as TimelineItem;
        } catch (error) {
            throw new TimelineApiError(
                error instanceof Error ? `Failed to decrypt timeline item: ${error.message}` : "Failed to decrypt timeline item"
            );
        }
    }));
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
        return decryptTimelineItems(data.items);
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
        return decryptTimelineItems(data.items);
    },

    /**
     * Create a new timeline item
     */
    async create(
        dto: CreateTimelineItemDto & { childId: string },
        signatureData: { signatureBase64: string; timestamp: string; keyId: string }
    ): Promise<TimelineItem> {
        const payload = {
            ...dto,
            ...signatureData
        };

        const response = await fetch(`${API_BASE_URL}/timeline`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
        });

        const item = await handleResponse<TimelineItem>(response);
        const [decrypted] = await decryptTimelineItems([item]);
        return decrypted;
    },

    /**
     * Update an existing timeline item
     * Note: We now send the full item back to the server for re-encryption + signatures
     */
    async update(
        id: string,
        fullItem: TimelineItem,
        signatureData: { signatureBase64: string; timestamp: string; keyId: string }
    ): Promise<TimelineItem> {
        const payload = {
            ...fullItem,
            ...signatureData
        };

        const response = await fetch(`${API_BASE_URL}/timeline/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
        });

        const item = await handleResponse<TimelineItem>(response);
        const [decrypted] = await decryptTimelineItems([item]);
        return decrypted;
    },

    /**
     * Delete a timeline item
     */
    async delete(
        id: string,
        signatureData: { signatureBase64: string; timestamp: string; keyId: string }
    ): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/timeline/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(signatureData),
        });

        return handleResponse<void>(response);
    }
};
