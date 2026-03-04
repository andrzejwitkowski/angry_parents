import { describe, it, expect, beforeAll } from "bun:test";
import { BunCryptoService, generateDevRSAKeyPair } from "../../adapters/secondary/BunCryptoService";

describe("BunCryptoService - RSA-OAEP Encryption", () => {
    let cryptoService: BunCryptoService;
    let devKeys: { publicKey: string; privateKey: string };

    beforeAll(async () => {
        cryptoService = new BunCryptoService();
        devKeys = await generateDevRSAKeyPair();
    });

    // Helper for testing only - frontend will do this
    async function decryptRSATestHelper(ciphertextBase64: string, privateKeyBase64: string): Promise<string> {
        const envelope = JSON.parse(Buffer.from(ciphertextBase64, "base64").toString("utf8"));

        const privateKeyBuffer = new Uint8Array(Buffer.from(privateKeyBase64, "base64"));
        const key = await crypto.subtle.importKey(
            "pkcs8",
            privateKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["decrypt"]
        );

        const encryptedAesKey = new Uint8Array(Buffer.from(envelope.k, "base64"));
        const iv = new Uint8Array(Buffer.from(envelope.iv, "base64"));
        const encryptedData = new Uint8Array(Buffer.from(envelope.d, "base64"));

        const rawAesKey = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            key,
            encryptedAesKey
        );

        const aesKey = await crypto.subtle.importKey(
            "raw",
            rawAesKey,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            encryptedData
        );

        return new TextDecoder().decode(decryptedData);
    }

    it("should encrypt and decrypt a short string", async () => {
        const plaintext = "This is a secret note.";

        const ciphertext = await cryptoService.encryptRSA(plaintext, devKeys.publicKey);
        expect(ciphertext).not.toBe(plaintext);
        expect(ciphertext.length).toBeGreaterThan(100);

        const decrypted = await decryptRSATestHelper(ciphertext, devKeys.privateKey);
        expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt a long JSON string", async () => {
        const longData = {
            id: "123",
            doctor: "Dr. Who",
            diagnosis: "Time travel sickness, needs more rest and less wibbly wobbly timey wimey stuff.",
            medications: ["Tardis tea", "Sonic screwdriver waves"]
        };
        const plaintext = JSON.stringify(longData);

        const ciphertext = await cryptoService.encryptRSA(plaintext, devKeys.publicKey);
        expect(ciphertext).not.toBe(plaintext);

        const decrypted = await decryptRSATestHelper(ciphertext, devKeys.privateKey);
        expect(decrypted).toBe(plaintext);
        expect(JSON.parse(decrypted)).toEqual(longData);
    });

    it("should fail to decrypt with wrong private key", async () => {
        const plaintext = "Top secret!";
        const ciphertext = await cryptoService.encryptRSA(plaintext, devKeys.publicKey);

        // Generate a different key pair
        const wrongKeys = await crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );
        const wrongPrivateKeyBuffer = await crypto.subtle.exportKey("pkcs8", wrongKeys.privateKey);
        const wrongPrivateKeyBase64 = Buffer.from(wrongPrivateKeyBuffer).toString("base64");

        await expect(decryptRSATestHelper(ciphertext, wrongPrivateKeyBase64)).rejects.toThrow();
    });
});
