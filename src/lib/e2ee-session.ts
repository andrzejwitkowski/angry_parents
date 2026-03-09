import { clearPrivateKey, getPrivateKey, savePrivateKey } from "@/lib/idb-crypto";
import { authApi } from "@/lib/api/auth";

let cachedTimelinePrivateKey: CryptoKey | null = null;
let cachedTimelinePrivateKeyUserId: string | null = null;
let activeUserId: string | null = null;
let activeUserIdPromise: Promise<string | null> | null = null;
let isSessionLocked = true;
let timelineKeyRequestVersion = 0;
let activeUserIdRequestVersion = 0;
let activeUserIdRequestToken: object | null = null;

/**
 * Sets the user whose local E2EE key cache is currently active on this device.
 * Any pending identity or timeline-key lookups are invalidated when the user changes.
 */
export function setActiveE2eeUserId(userId: string | null) {
    timelineKeyRequestVersion += 1;
    activeUserIdRequestVersion += 1;
    activeUserIdRequestToken = null;
    activeUserId = userId;
    activeUserIdPromise = null;

    if (cachedTimelinePrivateKeyUserId !== userId) {
        clearTimelinePrivateKeyCache();
    }
}

export function markE2eeSessionLocked() {
    isSessionLocked = true;
    timelineKeyRequestVersion += 1;
    clearTimelinePrivateKeyCache();
}

export function markE2eeSessionUnlocked() {
    isSessionLocked = false;
}

/**
 * Resolves the current active E2EE user id while guarding against stale async auth responses.
 */
export async function getActiveE2eeUserId(): Promise<string | null> {
    const resolvedUserId = await resolveActiveUserId();
    if (activeUserId && resolvedUserId !== activeUserId) {
        return activeUserId;
    }

    return resolvedUserId;
}

async function resolveActiveUserId(): Promise<string | null> {
    if (activeUserId) {
        return activeUserId;
    }

    if (!activeUserIdPromise) {
        const requestVersion = ++activeUserIdRequestVersion;
        const requestToken = {};
        activeUserIdRequestToken = requestToken;
        const requestPromise = authApi.getMe()
            .then((me) => {
                const resolvedUserId = me?.user?.id || null;
                if (
                    requestVersion !== activeUserIdRequestVersion ||
                    activeUserIdRequestToken !== requestToken ||
                    (activeUserId !== null && activeUserId !== resolvedUserId)
                ) {
                    return activeUserId;
                }

                activeUserId = resolvedUserId;
                return activeUserId;
            })
            .catch(() => {
                if (
                    requestVersion !== activeUserIdRequestVersion ||
                    activeUserIdRequestToken !== requestToken
                ) {
                    return activeUserId;
                }

                return null;
            })
            .finally(() => {
                if (activeUserIdRequestToken === requestToken) {
                    activeUserIdRequestToken = null;
                }

                if (activeUserIdPromise === requestPromise) {
                    activeUserIdPromise = null;
                }
            });

        activeUserIdPromise = requestPromise;
    }

    return activeUserIdPromise;
}

/**
 * Checks whether the active user (or provided user) has a locally stored private key.
 */
export async function hasStoredPrivateKey(userId?: string | null): Promise<boolean> {
    const resolvedUserId = userId ?? await resolveActiveUserId();
    if (!resolvedUserId) {
        return false;
    }

    return Boolean(await getPrivateKey(resolvedUserId));
}

/**
 * Clears the locally stored private key for the active user and marks the session locked.
 */
export async function clearActivePrivateKey(userId?: string | null): Promise<void> {
    const resolvedUserId = userId ?? await resolveActiveUserId();
    markE2eeSessionLocked();

    if (!resolvedUserId) {
        return;
    }

    await clearPrivateKey(resolvedUserId);
}

/**
 * Creates and stores a development-only private key so local E2EE flows can be exercised.
 */
export async function bootstrapDevSessionKey(userId?: string | null): Promise<string | null> {
    const resolvedUserId = userId ?? await resolveActiveUserId();
    if (!resolvedUserId) {
        return null;
    }

    const devPrivateKey = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        false,
        ["decrypt", "unwrapKey"]
    );

    await savePrivateKey(resolvedUserId, devPrivateKey.privateKey);
    setActiveE2eeUserId(resolvedUserId);
    markE2eeSessionUnlocked();
    return resolvedUserId;
}

/**
 * Returns the cached timeline private key when the session is unlocked and the request is still current.
 */
export async function getTimelinePrivateKey(): Promise<CryptoKey | null> {
    const requestVersion = timelineKeyRequestVersion;

    if (isSessionLocked) {
        return null;
    }

    const userId = await resolveActiveUserId();
    if (!userId || isSessionLocked || requestVersion !== timelineKeyRequestVersion) {
        clearTimelinePrivateKeyCache();
        return null;
    }

    if (cachedTimelinePrivateKey && cachedTimelinePrivateKeyUserId === userId) {
        return cachedTimelinePrivateKey;
    }

    const privateKey = await getPrivateKey(userId);
    if (isSessionLocked || requestVersion !== timelineKeyRequestVersion) {
        clearTimelinePrivateKeyCache();
        return null;
    }

    cachedTimelinePrivateKey = privateKey;
    cachedTimelinePrivateKeyUserId = privateKey ? userId : null;
    return privateKey;
}

export function clearTimelinePrivateKeyCache() {
    cachedTimelinePrivateKey = null;
    cachedTimelinePrivateKeyUserId = null;
}
