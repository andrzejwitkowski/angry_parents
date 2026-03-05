import type { TimelineItem, CreateTimelineItemDto } from "@/types/timeline.types";
import { decryptRSA, importPrivateKey, encryptRSA, importPublicKey } from "@/lib/crypto-utils";
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

let cachedPrivateKey: CryptoKey | null = null;
const PROTECTED_FIELDS = new Set([
    "id", "date", "type", "createdAt", "createdBy", "createdByName", "auditTrail", "isDeleted", "childIds", "encryptedPayload", "ciphertext"
]);


// TODO(prod): decryptTimelineItems currently only decrypts in DEV mode using VITE_DEV_RSA_PRIVATE_KEY.
// For production, implement real private-key retrieval (e.g. from IndexedDB/WebCrypto keystore)
// or surface a clear UX message for encrypted-but-unreadable items.
async function decryptTimelineItems(items: TimelineItem[]): Promise<TimelineItem[]> {
    const isDev = import.meta.env.DEV;
    const privateKeyBase64 = import.meta.env.VITE_DEV_RSA_PRIVATE_KEY;

    if (!isDev || !privateKeyBase64) return items;

    if (!cachedPrivateKey) {
        cachedPrivateKey = await importPrivateKey(privateKeyBase64);
    }

    return Promise.all(items.map(async (item: any) => {
        if (item.encryption === "PLAINTEXT") return item;

        const currentUserId = cachedMeData?.user?.id;
        const ciphertext = currentUserId && item.encryptedPayload
            ? item.encryptedPayload[currentUserId] ?? item.ciphertext
            : item.ciphertext;

        if (!ciphertext) {
            console.warn(
                `[TimelineApi] Decryption skipped for item ${item.id}: "ciphertext" is missing or empty. ` +
                `This usually means the current user (ID: ${privateKeyBase64.substring(0, 10)}...) is not included in the item's encryptedPayload in the backend.`
            );
            return item;
        }

        try {
            const privateKey = cachedPrivateKey!;
            const decrypted = await decryptRSA(ciphertext, privateKey);
            const decryptedFields = JSON.parse(decrypted);

            if (typeof decryptedFields !== 'object' || decryptedFields === null || Array.isArray(decryptedFields)) {
                console.warn("Decrypted fields are not a plain object:", decryptedFields);
                return item;
            }

            const base = { ...item } as any;
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

// Browser-side cache for getMe() — safe as module-level variable since there's
// only one authenticated user per browser tab (same pattern as cachedPrivateKey).
let cachedMeData: Awaited<ReturnType<typeof authApi.getMe>> | null = null;
let cachedMeTimestamp = 0;
const ME_CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateMeCache() {
    cachedMeData = null;
    cachedMeTimestamp = 0;
}

async function encryptTimelineItem(item: any): Promise<any> {
    const now = Date.now();
    if (!cachedMeData || now - cachedMeTimestamp > ME_CACHE_TTL_MS) {
        cachedMeData = await authApi.getMe();
        cachedMeTimestamp = now;
    }
    const { family } = cachedMeData;
    if (!family || !family.parentPublicKeys || family.parentPublicKeys.length < 2) {
        throw new Error("Cannot encrypt: Both parents must have registered RSA public keys.");
    }

    const unencryptedFields: Record<string, any> = {};
    const sensitiveFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(item)) {
        if (PROTECTED_FIELDS.has(key)) {
            unencryptedFields[key] = value;
        } else if (value !== undefined) {
            sensitiveFields[key] = value;
        }
    }

    const plaintext = JSON.stringify(sensitiveFields);
    const encryptedPayload: Record<string, string> = {};

    for (const keyInfo of family.parentPublicKeys) {
        const publicKey = await importPublicKey(keyInfo.rsaPublicKeyBase64);
        encryptedPayload[keyInfo.parentId] = await encryptRSA(plaintext, publicKey);
    }

    return {
        ...unencryptedFields,
        encryption: "ENCRYPTED",
        encryptedPayload
    };
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
        signatureData: MutationSignature
    ): Promise<TimelineItem> {
        const encrypted = await encryptTimelineItem({
            ...dto,
            childIds: [dto.childId]
        });

        // Strip fields not expected by backend schema
        const { encryption, id, childId, ciphertext, encryptedPayload, ...cleanEncrypted } = encrypted;

        const payload = {
            ...cleanEncrypted,
            encryptedPayload: encrypted.encryptedPayload,
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

        const encrypted = await encryptTimelineItem({
            ...fullItem,
            id,
            childIds: [resolvedChildId]
        });

        const payload = {
            date: encrypted.date,
            childIds: encrypted.childIds,
            encryptedPayload: encrypted.encryptedPayload,
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
