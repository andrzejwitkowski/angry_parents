import type { Passkey } from "../model/Passkey";

export interface PasskeyRepository {
    save(passkey: Passkey): Promise<void>;
    findByUserId(userId: string): Promise<Passkey[]>;
    findByCredentialID(credentialID: Uint8Array): Promise<Passkey | null>;
    countByUserId(userId: string): Promise<number>;
    updateCounter(credentialID: Uint8Array, newCounter: number): Promise<void>;
}
