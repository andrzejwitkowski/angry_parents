
import { ICryptoService } from "../../core/ports/ICryptoService";

/**
 * Returns development RSA key pair for non-production use.
 * Uses env-provided keys when available, otherwise generates an ephemeral pair.
 */
export async function generateDevRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Dev RSA key pair generation is disabled in production.");
    }

    const envPublicKey = process.env.DEV_RSA_PUBLIC_KEY;
    const envPrivateKey = process.env.DEV_RSA_PRIVATE_KEY;
    if (envPublicKey && envPrivateKey) {
        return { publicKey: envPublicKey, privateKey: envPrivateKey };
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
    const publicKey = Buffer.from(await crypto.subtle.exportKey("spki", keyPair.publicKey)).toString("base64");
    const privateKey = Buffer.from(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)).toString("base64");
    return { publicKey, privateKey };
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
}
