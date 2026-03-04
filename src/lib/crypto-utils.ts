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
        k: btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))),
        iv: btoa(String.fromCharCode(...iv)),
        d: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
    };

    return btoa(JSON.stringify(envelope));
}
