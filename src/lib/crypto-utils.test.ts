import { describe, it, expect, beforeAll } from "bun:test";
import { encryptRSA, decryptRSA, importPublicKey, importPrivateKey } from "./crypto-utils";

describe("crypto-utils", () => {
    let publicKeyBase64: string;
    let privateKeyBase64: string;

    beforeAll(async () => {
        // Generate a test key pair
        const keyPair = await globalThis.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        const spki = await globalThis.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const pkcs8 = await globalThis.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

        publicKeyBase64 = Buffer.from(spki).toString("base64");
        privateKeyBase64 = Buffer.from(pkcs8).toString("base64");
    });

    it("should encrypt and decrypt a string", async () => {
        const plaintext = "Hello E2EE!";
        const publicKey = await importPublicKey(publicKeyBase64);
        const ciphertext = await encryptRSA(plaintext, publicKey);

        expect(ciphertext).not.toBe(plaintext);
        expect(ciphertext).toBeTypeOf("string");

        // Decrypt
        const privateKey = await importPrivateKey(privateKeyBase64);
        const decrypted = await decryptRSA(ciphertext, privateKey);
        expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt a JSON object string", async () => {
        const data = { foo: "bar", baz: 123 };
        const plaintext = JSON.stringify(data);
        const publicKey = await importPublicKey(publicKeyBase64);
        const ciphertext = await encryptRSA(plaintext, publicKey);

        const privateKey = await importPrivateKey(privateKeyBase64);
        const decrypted = await decryptRSA(ciphertext, privateKey);
        expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("should fail to decrypt with wrong key", async () => {
        const plaintext = "Secret";
        const publicKey = await importPublicKey(publicKeyBase64);
        const ciphertext = await encryptRSA(plaintext, publicKey);

        // Generate another key
        const otherKeyPair = await globalThis.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );
        const otherPkcs8 = await globalThis.crypto.subtle.exportKey("pkcs8", otherKeyPair.privateKey);
        const otherPrivateKeyBase64 = Buffer.from(otherPkcs8).toString("base64");

        const otherPrivateKey = await importPrivateKey(otherPrivateKeyBase64);
        await expect(decryptRSA(ciphertext, otherPrivateKey)).rejects.toThrow();
    });
});
