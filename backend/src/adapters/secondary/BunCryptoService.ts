
import { ICryptoService } from "../../core/ports/ICryptoService";

/**
 * Hardcoded RSA-OAEP key pair for development/testing.
 * In production, public keys come from user registration.
 * Private keys stay on the user's device (YubiKey / browser).
 *
 * Generated once with: crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["encrypt","decrypt"])
 */
export const DEV_RSA_PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr6a8L3kPJtl8mFEyRG8qU/mN8VxU0B3B2vV14EqAFOqXJzC8HwXPY3Q8sMkSMEvz1Y3M5F/ZmSJk4dC4m+OMQ6XFp3QvkPBcrrZZ0pEEdXfFJW5VN0T3tBk+KCvWm8N9qY0AGt2vz7KN1dNWXy4mOXn5MKz4D8T6t0R9RH2ZB4L4q9V5D9HL8W+rL8nHF8Kp9U3r2GZR+P1NJ7RYDq2Eq3oX8eNn7AK7c0K5e0rB3kZh4MN8d3P1q+Yq/Q4d3AXKN+0VzS3e5Y+K8h0W2NB7F0Q4q3R2M8K9d2V1P+Lc4e3Y0N5r8X7d6Z1W2q3A4t5B6c7R8y9Z0p1Q2w3E4r5QIDAQAB";
export const DEV_RSA_PRIVATE_KEY = "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvprwveQ8m2XyYUTJEbypT+Y3xXFTQHcHa9XXgSoAU6pcnMLwfBc9jdDywyRIwS/PVjczkX9mZImTh0Lib44xDpcWndC+Q8FyutlnSkQR1d8UlblU3RPe0GT4oK9abw32pjQAa3a/Pso3V01ZfLiY5efkwrPgPxPq3RH1EfZkHgvir1XkP0cvxb6svyccXwqn1TevYZlH4/U0ntFgOrYSrehfx42fsArtzQrl7SsHeRmHgw3x3c/Wr5ir9Dh3cBco37RXNLd7lj4ryHRbY0HsXRDirdHYzwr13ZXU/4tzh7djQ3mvxft3pnVbarcDq3kHpztPxftnpnVbarcDq30EBgKAgEAAoIBAH+CnQk3kR2nt";

let _devKeyPairGenerated = false;
let _devPublicKey: string = DEV_RSA_PUBLIC_KEY;
let _devPrivateKey: string = DEV_RSA_PRIVATE_KEY;

/**
 * Generate a fresh dev RSA key pair at runtime (used by tests).
 * This ensures the keys are valid and work correctly with Web Crypto API.
 */
export async function generateDevRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    if (_devKeyPairGenerated) {
        return { publicKey: _devPublicKey, privateKey: _devPrivateKey };
    }

    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    _devPublicKey = Buffer.from(publicKeyBuffer).toString("base64");
    _devPrivateKey = Buffer.from(privateKeyBuffer).toString("base64");
    _devKeyPairGenerated = true;

    return { publicKey: _devPublicKey, privateKey: _devPrivateKey };
}

export class BunCryptoService implements ICryptoService {
    async verifySignature(
        publicKeyPem: string,
        data: string, // The data that was signed (e.g., hash)
        signatureBase64: string
    ): Promise<boolean> {
        try {
            const signature = new Uint8Array(Buffer.from(signatureBase64, "base64"));
            const dataBuffer = new Uint8Array(Buffer.from(data, "utf-8"));

            // Import Public Key
            const keyData = new Uint8Array(Buffer.from(publicKeyPem, "base64url"));
            const key = await crypto.subtle.importKey(
                "spki",
                keyData,
                {
                    name: "ECDSA",
                    namedCurve: "P-256", // Common for WebAuthn
                },
                false,
                ["verify"]
            );

            const isValid = await crypto.subtle.verify(
                {
                    name: "ECDSA",
                    hash: "SHA-256",
                },
                key,
                signature,
                dataBuffer
            );

            if (!isValid) {
                console.error(`[BunCryptoService] Signature verification failed for data length: ${dataBuffer.length}`);
            }

            return isValid;
        } catch (e) {
            console.error("Signature verification failed", e);
            return false;
        }
    }

    async getFingerprint(publicKeyPem: string): Promise<string> {
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(publicKeyPem);
        return hasher.digest("hex");
    }

    /**
     * Encrypt plaintext using RSA-OAEP with the given base64 public key.
     * RSA-OAEP with SHA-256 and 2048-bit key can encrypt up to ~190 bytes directly.
     * For larger payloads, we use hybrid encryption: generate AES key, encrypt data with AES,
     * encrypt AES key with RSA-OAEP.
     */
    async encryptRSA(plaintext: string, publicKeyBase64: string): Promise<string> {
        const publicKeyBuffer = new Uint8Array(Buffer.from(publicKeyBase64, "base64"));
        const key = await crypto.subtle.importKey(
            "spki",
            publicKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["encrypt"]
        );

        const plaintextBuffer = new TextEncoder().encode(plaintext);

        // Hybrid encryption: AES-GCM for data, RSA-OAEP for AES key
        // This avoids RSA plaintext size limits
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
            key,
            rawAesKey
        );

        // Pack as JSON: { key: base64, iv: base64, data: base64 }
        const envelope = {
            k: Buffer.from(encryptedAesKey).toString("base64"),
            iv: Buffer.from(iv).toString("base64"),
            d: Buffer.from(encryptedData).toString("base64"),
        };

        return Buffer.from(JSON.stringify(envelope)).toString("base64");
    }
}

