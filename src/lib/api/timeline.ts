import type { TimelineItem, CreateTimelineItemDto } from "@/types/timeline.types";
import { decryptRSA, importPublicKey, encryptRSA } from "@/lib/crypto-utils";
import { getActiveE2eeUserId, getTimelinePrivateKey, clearTimelinePrivateKeyCache } from "@/lib/e2ee-session";
import type { MutationSignature } from "@/lib/signature-provider";
import { authApi } from "./auth";

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

const PROTECTED_FIELDS = new Set([
    "id", "date", "type", "createdAt", "createdBy", "createdByName", "auditTrail", "isDeleted", "childIds", "encryptedPayload", "ciphertext", "encryption"
]);

async function decryptTimelineItems(items: TimelineItem[]): Promise<TimelineItem[]> {
    const privateKey = await getTimelinePrivateKey();
    const currentUserId = await getActiveE2eeUserId();

    if (!privateKey) return items;

    return Promise.all(items.map(async (item) => {
        if (item.encryption === "PLAINTEXT") return item;

        // If we have a direct ciphertext from the backend, use it.
        // Otherwise, try to find it in the encryptedPayload if we know who we are.
        let ciphertext = item.ciphertext;

        if (!ciphertext && item.encryptedPayload && currentUserId) {
            ciphertext = item.encryptedPayload[currentUserId];
        }

        if (!ciphertext) {
            console.warn(
                `[TimelineApi] Decryption skipped for item ${item.id}: "ciphertext" is missing or empty. ` +
                `This usually means the current user is not authorized to view this item.`
            );
            return item;
        }

        try {
            const decrypted = await decryptRSA(ciphertext, privateKey);
            const decryptedFields = JSON.parse(decrypted);

            if (typeof decryptedFields !== 'object' || decryptedFields === null || Array.isArray(decryptedFields)) {
                console.warn("Decrypted fields are not a plain object:", decryptedFields);
                return item;
            }

            const base = { ...item } as Record<string, unknown>;
            delete base.encryptedPayload;
            delete base.ciphertext;

            const safeDecryptedFields = Object.fromEntries(
                Object.entries(decryptedFields).filter(([key]) => !PROTECTED_FIELDS.has(key))
            );
            return {
                ...base,
                ...safeDecryptedFields,
                encryption: "PLAINTEXT"
            } as TimelineItem;
        } catch (error) {
            console.warn(
                `Failed to decrypt timeline item: ${error instanceof Error ? error.message : String(error)}`,
                { itemId: item.id, error }
            );
            return item;
        }
    }));
}

function clearDecryptionCaches() {
    clearTimelinePrivateKeyCache();
}


/**
 * Encrypts a timeline item's sensitive fields for all parents in the family.
 */
async function encryptTimelineItem(
    _type: string,
    contentFields: Record<string, any>
): Promise<Record<string, string>> {
    const { family } = await authApi.getMe();
    if (!family || !family.parentPublicKeys || family.parentPublicKeys.length === 0) {
        throw new Error("No family public keys found for encryption");
    }

    const encryptedPayload: Record<string, string> = {};
    const plaintext = JSON.stringify(contentFields);

    for (const parentKey of family.parentPublicKeys) {
        try {
            const publicKey = await importPublicKey(parentKey.rsaPublicKeyBase64);
            encryptedPayload[parentKey.parentId] = await encryptRSA(plaintext, publicKey);
        } catch (error) {
            console.error(`Failed to encrypt for parent ${parentKey.parentId}:`, error);
            throw new Error(`Encryption failed for parent ${parentKey.parentId}`);
        }
    }

    return encryptedPayload;
}

export const timelineApi = {
    clearDecryptionCaches,
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
        signatureData: MutationSignature
    ): Promise<TimelineItem> {
        // Perform client-side encryption of all sensitive fields
        const { type, date, childId, encryption, ...contentFields } = dto as any;

        const encryptedPayload = await encryptTimelineItem(type, contentFields);

        const payload = {
            type,
            date,
            childId,
            encryption: "ENCRYPTED",
            encryptedPayload,
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
        signatureData: MutationSignature,
        childId?: string
    ): Promise<TimelineItem> {
        const resolvedChildId = childId || (fullItem.childIds && fullItem.childIds[0]);
        if (!resolvedChildId) {
            throw new TimelineApiError("Cannot update timeline item: missing childId");
        }

        const { type, date, encryption, ...otherFields } = fullItem as any;
        // Strip sensitive fields that should be in the encrypted payload
        const contentFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(otherFields)) {
            if (!PROTECTED_FIELDS.has(key)) {
                contentFields[key] = value;
            }
        }

        // Always re-encrypt on update if fields are provided
        const encryptedPayload = await encryptTimelineItem(type, contentFields);

        const payload = {
            type,
            date,
            childId: resolvedChildId,
            encryption: "ENCRYPTED",
            encryptedPayload,
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
        signatureData: MutationSignature
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
