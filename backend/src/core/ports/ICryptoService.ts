
export interface ICryptoService {
    verifySignature(
        publicKey: string,
        data: string,
        signature: string
    ): Promise<boolean>;

    getFingerprint(publicKey: string): Promise<string>;

    /**
     * Encrypt plaintext using RSA-OAEP with the given public key.
     * Returns base64-encoded ciphertext.
     * Decryption happens client-side only — private keys never reach the backend.
     */
    encryptRSA(plaintext: string, publicKeyBase64: string): Promise<string>;
}
