import { createMockSignature } from "@/lib/mocks/cryptoMock";

export type MutationSignature = {
    signatureBase64: string;
    timestamp: string;
    keyId: string;
};

export async function getMutationSignature(): Promise<MutationSignature> {
    if (import.meta.env.DEV) {
        return createMockSignature();
    }

    throw new Error("Secure signature provider is not configured for this environment.");
}
