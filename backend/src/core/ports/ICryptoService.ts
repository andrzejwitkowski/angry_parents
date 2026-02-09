
export interface ICryptoService {
    verifySignature(
        publicKey: string,
        data: string,
        signature: string
    ): Promise<boolean>;

    getFingerprint(publicKey: string): Promise<string>;
}
