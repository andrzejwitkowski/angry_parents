
import { z } from "zod";

export const ForensicStatusSchema = z.enum(["PENDING", "FINALIZED"]);
export type ForensicStatus = z.infer<typeof ForensicStatusSchema>;

export const SignatureSchema = z.object({
    signerId: z.string(),
    signature: z.string(), // Base64 encoded signature
    timestamp: z.string().datetime(),
    keyId: z.string() // Key identifier (e.g. from YubiKey)
});
export type Signature = z.infer<typeof SignatureSchema>;

// Generic Forensic Document Wrapper
// Content T should be a Zod schema if we want to validate it, but for the generic class we just treat it as data.
export class ForensicDocument<T> {
    constructor(
        public readonly index: number,
        public readonly content: T,
        public readonly prevHash: string,
        public readonly timestamp: string,
        public status: ForensicStatus = "PENDING",
        public signatures: Signature[] = [],
        public hash: string = "", // Calculated hash
        public blockchainTxId?: string
    ) { }

    // Helper to create a plain object for hashing/serialization
    toPayload() {
        return {
            index: this.index,
            content: this.content,
            prevHash: this.prevHash,
            timestamp: this.timestamp
        };
    }
}
