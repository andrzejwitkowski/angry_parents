
import { ICryptoService } from "../../core/ports/ICryptoService";

export class BunCryptoService implements ICryptoService {
    async verifySignature(
        publicKeyPem: string,
        data: string, // The data that was signed (e.g., hash)
        signatureBase64: string
    ): Promise<boolean> {
        try {
            const signature = Buffer.from(signatureBase64, "base64");
            const dataBuffer = Buffer.from(data);

            // Import Public Key
            // Assuming SPKI format for generic WebAuthn keys? 
            // Or if it's a raw PEM. Bun.crypto can handle various formats.
            // For simplicity, we assume standard PEM or attempt to import.

            // Note: Bun.crypto usage for verification:
            const key = await Bun.crypto.subtle.importKey(
                "spki",
                Buffer.from(publicKeyPem, "base64"), // Assuming the stored pk is base64 encoded SPKI
                {
                    name: "ECDSA",
                    namedCurve: "P-256", // Common for WebAuthn
                },
                false,
                ["verify"]
            );

            return await Bun.crypto.subtle.verify(
                {
                    name: "ECDSA",
                    hash: "SHA-256",
                },
                key,
                signature,
                dataBuffer
            );
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
