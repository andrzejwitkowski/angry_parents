import type { Passkey } from "../../../../domain/auth/model/Passkey";
import type { PasskeyRepository } from "../../../../domain/auth/ports/PasskeyRepository";

function areEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export class InMemoryPasskeyRepository implements PasskeyRepository {
    private passkeys: Passkey[] = [];

    async save(passkey: Passkey): Promise<void> {
        const index = this.passkeys.findIndex((p) => areEqual(p.credentialID, passkey.credentialID));
        if (index >= 0) {
            this.passkeys[index] = passkey;
            return;
        }
        this.passkeys.push(passkey);
    }

    async findByUserId(userId: string): Promise<Passkey[]> {
        return this.passkeys.filter(p => p.userId === userId);
    }

    async findByCredentialID(credentialID: Uint8Array): Promise<Passkey | null> {
        return this.passkeys.find(p => areEqual(p.credentialID, credentialID)) || null;
    }

    async countByUserId(userId: string): Promise<number> {
        return this.passkeys.filter(p => p.userId === userId).length;
    }

    async updateCounter(credentialID: Uint8Array, newCounter: number): Promise<void> {
        const passkey = await this.findByCredentialID(credentialID);
        if (passkey) {
            passkey.counter = newCounter;
        }
    }

    clear(): void {
        this.passkeys = [];
    }
}
