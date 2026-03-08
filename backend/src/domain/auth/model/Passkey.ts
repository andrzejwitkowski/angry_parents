export interface Passkey {
    userId: string;
    webauthnUserId: string;
    credentialID: Uint8Array;
    credentialPublicKey: Uint8Array;
    counter: number;
    transports?: string[];
    createdAt: Date;
    name: string;
}
