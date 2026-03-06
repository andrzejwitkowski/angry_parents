export const PRIVATE_KEY_STORAGE_KEYS = [
    "zk_private_key",
    "zkPrivateKey",
    "privateKey",
    "rsaPrivateKey"
];

export function getPrivateKeyFromStorage(): string | null {
    if (typeof window === "undefined" || !window.localStorage) return null;
    for (const key of PRIVATE_KEY_STORAGE_KEYS) {
        const value = window.localStorage.getItem(key)?.trim();
        if (value) return value;
    }
    return null;
}

export async function importPublicKey(keyData: string): Promise<CryptoKey> {
    const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        "spki",
        keyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );
}

export async function importPrivateKey(keyData: string): Promise<CryptoKey> {
    const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
    );
}

export async function decryptRSA(ciphertext: string, privateKey: CryptoKey): Promise<string> {
    const decoded = atob(ciphertext);

    // Preferred format: hybrid envelope { k, iv, d } (frontend-originated encryption).
    try {
        const envelope = JSON.parse(decoded) as { k: string; iv: string; d: string };
        if (envelope?.k && envelope?.iv && envelope?.d) {
            const encryptedAesKey = Uint8Array.from(atob(envelope.k), c => c.charCodeAt(0));
            const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
            const encryptedData = Uint8Array.from(atob(envelope.d), c => c.charCodeAt(0));

            const rawAesKey = await crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                privateKey,
                encryptedAesKey
            );

            const aesKey = await crypto.subtle.importKey(
                "raw",
                rawAesKey,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                aesKey,
                encryptedData
            );

            return new TextDecoder().decode(decryptedBuffer);
        }
    } catch {
        // Fall through to legacy format handling below.
    }

    // Legacy format: raw RSA-OAEP ciphertext base64 (backend-originated encryption).
    const encryptedData = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Chunked byte-to-base64 conversion to avoid RangeError
 * when spreading large Uint8Arrays into String.fromCharCode().
 */
function bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000; // 32KB chunks
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(""));
}

export async function encryptRSA(plaintext: string, publicKey: CryptoKey): Promise<string> {
    const plaintextBuffer = new TextEncoder().encode(plaintext);

    // Hybrid encryption: AES-GCM for data, RSA-OAEP for AES key
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        plaintextBuffer
    );

    // Export and RSA-encrypt the AES key
    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    // Pack as JSON: { k: base64, iv: base64, d: base64 }
    const envelope = {
        k: bytesToBase64(new Uint8Array(encryptedAesKey)),
        iv: bytesToBase64(iv),
        d: bytesToBase64(new Uint8Array(encryptedData)),
    };

    return btoa(JSON.stringify(envelope));
}
