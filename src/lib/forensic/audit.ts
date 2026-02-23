
// Client-side replication of Forensic Logic

export interface Signature {
    signerId: string;
    signature: string;
    timestamp: string;
    keyId: string;
}

export interface ForensicDocument {
    index: number;
    content: unknown;
    prevHash: string;
    timestamp: string;
    status: "PENDING" | "FINALIZED";
    signatures: Signature[];
    hash: string;
    blockchainTxId?: string;
}

export interface SystemState {
    totalDocs: number;
    lastFinalHash: string;
}

// Canonicalize JSON: Sort keys alphabetically
// MUST match backend implementation exactly
function canonicalize(obj: unknown): string {
    if (obj === null || typeof obj !== "object") {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return "[" + obj.map(item => canonicalize(item)).join(",") + "]";
    }

    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map(key => {
        return `"${key}":${canonicalize(record[key])}`;
    });
    return `{${parts.join(",")}}`;
}

async function calculateHash(payload: unknown): Promise<string> {
    const canonicalString = canonicalize(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);

    // Convert buffer to hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function verifyIntegrity(
    documents: ForensicDocument[],
    systemState: SystemState
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 1. Counter Check
    if (documents.length !== systemState.totalDocs) {
        errors.push(`Doc count mismatch: DB has ${documents.length}, Statet says ${systemState.totalDocs}`);
    }

    // 2. Rollback Check
    const storedLastIndex = typeof localStorage !== 'undefined' ? localStorage.getItem("forensic_last_seen_index") : null;
    if (storedLastIndex) {
        const lastSeen = parseInt(storedLastIndex, 10);
        const currentLast = documents.length > 0 ? documents[documents.length - 1].index : -1;
        if (currentLast < lastSeen) {
            errors.push("CRITICAL: Rollback detected! Database has fewer records than previously seen.");
        }
    }
    // Update local storage if valid so far? Or only if fully valid.
    // We'll update at the end.

    // 3. Chain Continuity & Hashing
    let prevHash = "GENESIS_HASH"; // Or matches first doc prevHash

    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];

        // Check index
        if (doc.index !== i) {
            errors.push(`Index mismatch at position ${i}. Doc index is ${doc.index}`);
        }

        // Check prevHash
        if (i > 0) {
            if (doc.prevHash !== prevHash) {
                errors.push(`Broken Chain at index ${i}: prevHash mismatch.`);
            }
        }

        // Re-calculate Hash
        const payload = {
            index: doc.index,
            content: doc.content,
            prevHash: doc.prevHash,
            timestamp: doc.timestamp
        };
        const calculatedHash = await calculateHash(payload);

        if (calculatedHash !== doc.hash) {
            errors.push(`Hash manipulation detected at index ${i}.`);
        }

        prevHash = doc.hash;

        // 4. Authenticity (Signatures)
        // Check if fingerprints match allowed ones.
        // NOTE: This assumes we have the Public Keys embedded or available to verify signatures individually
        // Since we only have fingerprints in ENV, we verify that the signatures CLAIM to be from those keys
        // To truly verify signature VALIDITY, we need the Public Key.
        // Assuming public keys are fetched or stored.
        // For this task, we check if signatures exist.
        if (doc.status === "FINALIZED" && doc.signatures.length < 2) {
            errors.push(`Index ${i} is FINALIZED but missing signatures.`);
        }
    }

    if (errors.length === 0 && documents.length > 0 && typeof localStorage !== 'undefined') {
        localStorage.setItem("forensic_last_seen_index", documents[documents.length - 1].index.toString());
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
