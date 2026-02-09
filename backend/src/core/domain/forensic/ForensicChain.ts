
import { ForensicDocument } from "./ForensicDocument";

export class ForensicChain {
    // Canonicalize JSON: Sort keys authentically to ensure identical hash
    static canonicalize(obj: any): string {
        if (obj === null || typeof obj !== "object") {
            return JSON.stringify(obj);
        }

        if (Array.isArray(obj)) {
            return "[" + obj.map(item => ForensicChain.canonicalize(item)).join(",") + "]";
        }

        const keys = Object.keys(obj).sort();
        const parts = keys.map(key => {
            return `"${key}":${ForensicChain.canonicalize(obj[key])}`;
        });
        return `{${parts.join(",")}}`;
    }

    static async calculateHash(payload: any): Promise<string> {
        const canonicalString = ForensicChain.canonicalize(payload);
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(canonicalString);
        return hasher.digest("hex");
    }

    static async verifyIntegrity<T>(
        prevDoc: ForensicDocument<T> | null,
        currentDoc: ForensicDocument<T>
    ): Promise<boolean> {
        // 1. Check prevHash
        if (prevDoc) {
            if (currentDoc.prevHash !== prevDoc.hash) {
                return false; // Broken chain
            }
        } else {
            // Genesis block check capability if needed
        }

        // 2. Recalculate hash
        const payload = currentDoc.toPayload();
        const calculatedHash = await ForensicChain.calculateHash(payload);

        return calculatedHash === currentDoc.hash;
    }
}
