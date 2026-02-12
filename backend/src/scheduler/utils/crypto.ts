
import { createHash } from 'crypto';

/**
 * Deterministically stringifies a JSON object by sorting keys.
 * Handles nested objects and arrays.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        // Map each element and then stringify the array
        // Note: We do NOT sort arrays, as order usually matters in lists.
        // If order doesn't matter for a specific array, the caller should sort it before passing.
        const stringifiedElements = obj.map((item) => {
            // We parse back to object to let JSON.stringify handle the array structure correctly
            // but we need to canonicalize the internal structure of items if they are objects.
            // Actually, simpler: just map recursivly.
            if (typeof item === 'object' && item !== null) {
                return JSON.parse(canonicalize(item));
            }
            return item;
        });
        return JSON.stringify(stringifiedElements);
    }

    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = (obj as any)[key];
        if (typeof value === 'object' && value !== null) {
            // Recursive call but we need to parse it back to assign to object for final stringify
            // This is a bit inefficient (stringify -> parse -> stringify), but clear.
            // Better: just stringify the value recursively? No, we need to construct the sorted object.
            result[key] = JSON.parse(canonicalize(value));
        } else {
            result[key] = value;
        }
    }

    return JSON.stringify(result);
}

/**
 * optimized canonicalize that doesn't do multiple parse/stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stableStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    const parts = keys.map(key => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return JSON.stringify(key) + ':' + stableStringify((obj as any)[key]);
    });

    return '{' + parts.join(',') + '}';
}


/**
 * Calculates a SHA-256 hash of the payload using deterministic stringification.
 */
export function calculatePayloadHash<T>(payload: T): string {
    const canonicalString = stableStringify(payload);
    return createHash('sha256').update(canonicalString).digest('hex');
}
