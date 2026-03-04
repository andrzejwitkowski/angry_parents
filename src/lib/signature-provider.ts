import { createMockSignature } from "@/lib/mocks/cryptoMock";

export type MutationSignature = {
    signatureBase64: string;
    timestamp: string;
    keyId: string;
};

export async function getMutationSignature(): Promise<MutationSignature> {
    const isTestOrBunEnvironment = () => {
        try {
            // Safe checks that don't throw ReferenceError in browser
            // @ts-ignore
            return (typeof process !== "undefined" && (process.env.NODE_ENV === "test" || Boolean(process.versions?.bun))) ||
                // @ts-ignore
                (typeof Bun !== "undefined");
        } catch (e) {
            return false;
        }
    };

    if (import.meta.env.DEV || isTestOrBunEnvironment()) {
        return createMockSignature();
    }

    throw new Error("Secure signature provider is not configured for this environment.");
}
