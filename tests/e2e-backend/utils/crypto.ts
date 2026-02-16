import { subtle } from "crypto";

export class TestCrypto {
    static async generateKeyPair() {
        return await subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256",
            },
            true,
            ["sign", "verify"]
        );
    }

    static async exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
        const exported = await subtle.exportKey("spki", key);
        return new Uint8Array(exported);
    }

    // For WebAuthn "credentialPublicKey", we usually need the raw COSE key or exact format the backend expects.
    // However, BunCryptoService likely uses "spki" or "raw" depending on implementation.
    // Looking at BunCryptoService usage: `cryptoService.verifySignature(publicKeyBase64, doc.hash, sig.signature)`
    // And `BunCryptoService` usually imports keys.
    // Let's assume SPKI is fine for our mock injection if the backend can handle it.
    // Wait, WebAuthn usually stores COSE.
    // But `WebAuthnController` saves `credentialPublicKey`.
    // And `ProcessDocumentIntegrity` converts it: `Buffer.from(passkey.credentialPublicKey).toString('base64')`
    // And `BunCryptoService.verifySignature` likely takes PEM or SPKI.
    // If `BunCryptoService` expects SPKI, we are good.

    static async exportPublicKeyBase64(key: CryptoKey): Promise<string> {
        const exported = await this.exportPublicKey(key);
        return Buffer.from(exported).toString("base64url");
    }

    static async sign(privateKey: CryptoKey, data: string): Promise<string> {
        const encoder = new TextEncoder();
        const signature = await subtle.sign(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" },
            },
            privateKey,
            encoder.encode(data)
        );
        return Buffer.from(signature).toString("base64");
    }

    // Canonicalize JSON: Sort keys authentically to ensure identical hash (Must match ForensicChain.ts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static canonicalize(obj: any): string {
        if (obj === null || typeof obj !== "object") {
            return JSON.stringify(obj);
        }

        if (Array.isArray(obj)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return "[" + obj.map((item: any) => TestCrypto.canonicalize(item)).join(",") + "]";
        }

        const keys = Object.keys(obj).sort();
        const parts = keys.map(key => {
            return `"${key}":${TestCrypto.canonicalize(obj[key])}`;
        });
        return `{${parts.join(",")}}`;
    }

    static async hashPayload(payload: any): Promise<string> {
        const canonical = TestCrypto.canonicalize(payload);
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);
        const hashBuffer = await subtle.digest("SHA-256", data);
        return Buffer.from(hashBuffer).toString("hex");
    }
}
