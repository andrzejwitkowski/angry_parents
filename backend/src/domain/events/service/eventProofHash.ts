import { createHash } from "crypto";
import type { EncryptedTimelineVersionSnapshot } from "../model/TimelineItem";

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalize(value: unknown): CanonicalValue {
    if (value === null) {
        return null;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => canonicalize(entry));
    }

    if (typeof value === "object") {
        const normalizedEntries = Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
            .map(([key, entry]) => [key, canonicalize(entry)] as const);

        return Object.fromEntries(normalizedEntries);
    }

    return value as Exclude<CanonicalValue, CanonicalValue[] | { [key: string]: CanonicalValue }>;
}

function stableStringify(value: CanonicalValue): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    const entries = Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
}

export function canonicalizeEventProofSnapshot(snapshot: EncryptedTimelineVersionSnapshot): CanonicalValue {
    return canonicalize(snapshot);
}

export function calculateEventProofHash(snapshot: EncryptedTimelineVersionSnapshot): string {
    const canonicalString = stableStringify(canonicalizeEventProofSnapshot(snapshot));
    return createHash("sha256").update(canonicalString).digest("hex");
}
