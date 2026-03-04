import { createMockSignature } from "@/lib/mocks/cryptoMock";

export type MutationSignature = {
    signatureBase64: string;
    timestamp: string;
    keyId: string;
};

export async function getMutationSignature(): Promise<MutationSignature> {
    const isTestRuntime =
        import.meta.env.MODE === "test" ||
        (typeof process !== "undefined" && (process.env.NODE_ENV === "test" || Boolean(process.versions?.bun))) ||
        (typeof Bun !== "undefined");

    if (import.meta.env.DEV || isTestRuntime) {
        return createMockSignature();
    }

    throw new Error("Secure signature provider is not configured for this environment.");
}
