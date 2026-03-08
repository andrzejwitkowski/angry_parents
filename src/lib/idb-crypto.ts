/**
 * IndexedDB utility for storing non-extractable CryptoKey objects.
 * This provides better security than localStorage as the key material
 * cannot be easily read by simple scripts (XSS).
 */

const DB_NAME = 'angry_parents_crypto';
const STORE_NAME = 'private_keys';
const DB_VERSION = 1;

export async function openCryptoDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function savePrivateKey(userId: string, key: CryptoKey): Promise<void> {
    const db = await openCryptoDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(key, userId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
    const db = await openCryptoDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function clearPrivateKey(userId: string): Promise<void> {
    const db = await openCryptoDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(userId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
