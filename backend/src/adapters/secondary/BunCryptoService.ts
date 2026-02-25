
import { ICryptoService } from "../../core/ports/ICryptoService";

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
