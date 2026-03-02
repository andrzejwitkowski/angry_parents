import type { TimelineItem, CreateTimelineItemDto } from "@/types/timeline.types";
import { decryptRSA, importPrivateKey } from "@/lib/crypto-utils";

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
const PROTECTED_FIELDS = new Set([
    "id", "date", "type", "createdAt", "createdBy", "createdByName", "auditTrail", "isDeleted", "childIds", "encryptedPayload"
]);

export type SignatureData = {
    signatureBase64: string;
    timestamp: string;
    keyId: string;
};

async function decryptTimelineItems(items: TimelineItem[]): Promise<TimelineItem[]> {
    const privateKeyBase64 = import.meta.env.VITE_DEV_RSA_PRIVATE_KEY;
    if (!import.meta.env.DEV || !privateKeyBase64) return items;

    if (!cachedPrivateKey) {
        cachedPrivateKey = await importPrivateKey(privateKeyBase64);
    }

    return Promise.all(items.map(async (item) => {
        if (!item.encryptedPayload) return item;

        const payload = item.encryptedPayload;
        const ciphertexts = [payload.encryptedForMom, payload.encryptedForDad].filter((v): v is string => Boolean(v));
        if (ciphertexts.length === 0) return item;

        let lastError: unknown = null;
        for (const ciphertext of ciphertexts) {
            try {
                const decrypted = await decryptRSA(ciphertext, cachedPrivateKey as CryptoKey);
                const decryptedFields = JSON.parse(decrypted);

                // BUGFIX: Ensure decryptedFields is a non-null object before merging
                if (typeof decryptedFields !== 'object' || decryptedFields === null || Array.isArray(decryptedFields)) {
                    console.warn("Decrypted fields are not a plain object:", decryptedFields);
                    return item;
                }

                const base = { ...item } as Partial<TimelineItem>;
                delete base.encryptedPayload;
                const safeDecryptedFields = Object.fromEntries(
                    Object.entries(decryptedFields).filter(([key]) => !PROTECTED_FIELDS.has(key))
                );
                return {
                    ...base,
                    ...safeDecryptedFields
                } as TimelineItem;
            } catch (error) {
                lastError = error;
            }
        }

        console.warn(
            lastError instanceof Error ? `Failed to decrypt timeline item: ${lastError.message}` : "Failed to decrypt timeline item"
        );
        return item;
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
        signatureData: SignatureData
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
        signatureData: SignatureData
    ): Promise<TimelineItem> {
        // BUGFIX: Enforce that payload.id matches the URL id to prevent mismatches
        const payload = {
            ...fullItem,
            id: id,
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
        signatureData: SignatureData
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
