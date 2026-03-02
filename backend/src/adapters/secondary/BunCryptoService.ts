
import { ICryptoService } from "../../core/ports/ICryptoService";

/**
 * Hardcoded RSA-OAEP key pair for development/testing.
 * In production, public keys come from user registration.
 * Private keys stay on the user's device (YubiKey / browser).
 *
 * Generated once with: crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["encrypt","decrypt"])
 */
export const DEV_RSA_PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkHUMBn9bLKWOe8lJ8Bss5KVElYK13JzKgK4d/A4fUiyAQlBbp6RIiFOtxmZej6sNrk9XgxLL3HiVyESIMets5yFODa45eClhVIvPCdc53xMS/kbztPdBvQPSIwts9hpcjWU5oOLVB8kGxkR3+yI1O0QbM8iYAUqEEOxbGBwXAMj4/FdQ7jshfmj6PhfrlnNsi9YdqbT1TCjKUQTeP37JFVWDm8ID3PWpVGKn+pxT/9TyuNZmYjAoZqtd3x0qdn7eQjlJo9AsZ/F45szqDU8X2MBZHQ4U/8BbmF41X2i7ejVUvmCd9AmSvba+g6lJSNBXomc+cn/TCyaxeUruNhqIMwIDAQAB";
export const DEV_RSA_PRIVATE_KEY = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCQdQwGf1sspY57yUnwGyzkpUSVgrXcnMqArh38Dh9SLIBCUFunpEiIU63GZl6Pqw2uT1eDEsvceJXIRIgx62znIU4Nrjl4KWFUi88J1znfExL+RvO090G9A9IjC2z2GlyNZTmg4tUHyQbGRHf7IjU7RBszyJgBSoQQ7FsYHBcAyPj8V1DuOyF+aPo+F+uWc2yL1h2ptPVMKMpRBN4/fskVVYObwgPc9alUYqf6nFP/1PK41mZiMChmq13fHSp2ft5COUmj0Cxn8XjmzOoNTxfYwFkdDhT/wFuYXjVfaLt6NVS+YJ30CZK9tr6DqUlI0FeiZz5yf9MLJrF5Su42GogzAgMBAAECggEALXNmUTUI7sc4SWJPzSf/vADzz0bNCZibbllaPdADsssln7fA3sIlwB7z8hSLdBCRwWJdWnQziC64kcZeQ7abES29bTiABHqgkQVcIvCA2Nsbgr24OBwDpwDowPX7VoN801AiDajQ9h4d74vjZDSjIv6OwIBAs0dKvjhfgPp1kl0wVh25TuxdtGr0Y3qe+MBCANQUHfpdt71AF4dr1chPtep9YXYIpKklR2S8Xy8ZZCHaI9QYqc+Pss27KAL+HCbWNDJvsL52or8v9eX5DfL/QMkZK/MXQyt1/HJk552llmMFqYc1Wxxl8hW169GVzW/g7Hez9jK2+9QRK8ZCg6JKIQKBgQDBjlPoCknePGqPRhYsrLbER8eWfw8NY+W19QDefsTrZRbpmleUMxNjng4+G014mT+bfUe/CzO7ZksanGU5Lm4GYRaJtiA1x7tsdbvq2uBLpB3FZ9n8jubvqkZsNNNGidnOSAcIwOOFW87l6o7cQgIu+x+E8JrfsvgcH0ONJWBpRQKBgQC/D66yLmmVFq6BCZlUM0syziMGq1Zaf2RN9LpPitexgzmLgVk6Pr5xaCOZpY81viTuR3KwTf6kSz8Qrz/vs/djSdyhZb1hIfORt49yEBEsM7yf3JS+oGPpE2IcX1ddvzxWe8CK/ZfDAoMVtg+6jw2LxYQB1tSMRG3J8bL6Ppp3FwKBgA3EyCc7hCGw/ouOmsk2yBGSYZpNE48KSi71bMhnEC8Gk+iuOAis0XZGqhC09H/dtu6irNXkQBvWnQUZlwHIUb9WbLoDIKtyt9xxS5rbUxVOaWe/iXwz1i26WSQdZeIgsEPCT+3JeuXjsAYe92ans2wQJR/Z1cqP+qJVfwKtY/xZAoGBAL6jdzxy8wa/yv8WBNfvFmlrJafR7if+VKc0OXKEpxOITDLWraFgWcXukxcMCwkk4NSgld8085AbRKHxO2qBt6ZqXKruSThSGCadcZPuVDQ2q08XWZOblhVKMer9dr8jwaDJeiU1Q+hg6UsQjkEn2+xK+JydLxeGb8XAVUU8kgOhAoGASoGFnuSfb0SkcsUE0pDTqoZA7GMfnqleqSsKtv4vLQM5FKUGG4Nti+L6+ytKJoi2BGUIgacVbf4jL9C++evyMjRX9tNsKn/+Tph6EJZk7u0CzJwQxOs9y2/l4WNzMiV7BNbPJESM692XTO9TbI+omKyI8SQTdg9+wtL+y8g7QdE=";

/**
 * Returns deterministic dev RSA key pair for development/testing.
 */
export async function generateDevRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Dev RSA key pair generation is disabled in production.");
    }
    return { publicKey: DEV_RSA_PUBLIC_KEY, privateKey: DEV_RSA_PRIVATE_KEY };
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
