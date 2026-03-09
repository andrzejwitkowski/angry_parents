import { clearPrivateKey, getPrivateKey } from "@/lib/idb-crypto";
import { authApi } from "@/lib/api/auth";

let cachedTimelinePrivateKey: CryptoKey | null = null;
let cachedTimelinePrivateKeyUserId: string | null = null;
let activeUserId: string | null = null;
let activeUserIdPromise: Promise<string | null> | null = null;
let isSessionLocked = true;
let timelineKeyRequestVersion = 0;

export function setActiveE2eeUserId(userId: string | null) {
    timelineKeyRequestVersion += 1;
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

export async function getActiveE2eeUserId(): Promise<string | null> {
    return resolveActiveUserId();
}

async function resolveActiveUserId(): Promise<string | null> {
    if (activeUserId) {
        return activeUserId;
    }

    if (!activeUserIdPromise) {
        activeUserIdPromise = authApi.getMe()
            .then((me) => {
                activeUserId = me?.user?.id || null;
                activeUserIdPromise = null;
                return activeUserId;
            })
            .catch(() => {
                activeUserIdPromise = null;
                return null;
            });
    }

    return activeUserIdPromise;
}

export async function hasStoredPrivateKey(userId?: string | null): Promise<boolean> {
    const resolvedUserId = userId ?? await resolveActiveUserId();
    if (!resolvedUserId) {
        return false;
    }

    return Boolean(await getPrivateKey(resolvedUserId));
}

export async function clearActivePrivateKey(userId?: string | null): Promise<void> {
    const resolvedUserId = userId ?? await resolveActiveUserId();
    markE2eeSessionLocked();

    if (!resolvedUserId) {
        return;
    }

    await clearPrivateKey(resolvedUserId);
}

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
