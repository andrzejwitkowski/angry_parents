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
    const envelopeJson = atob(ciphertext);
    const envelope = JSON.parse(envelopeJson) as { k: string; iv: string; d: string };
    if (!envelope.k || !envelope.iv || !envelope.d) {
        throw new Error("Invalid encrypted envelope");
    }

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
