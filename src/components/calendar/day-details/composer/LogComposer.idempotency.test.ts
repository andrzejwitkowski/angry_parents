import { describe, expect, jest, test } from "bun:test";
import { ensureComposerIdempotencyKey } from "./LogComposer";

describe("ensureComposerIdempotencyKey", () => {
    test("reuses an existing idempotency key without generating a new one", () => {
        const setIdempotencyKey = jest.fn();
        const generate = jest.fn(() => "11111111-1111-4111-8111-111111111111");

        const result = ensureComposerIdempotencyKey("existing-key", setIdempotencyKey, generate);

        expect(result).toBe("existing-key");
        expect(generate).not.toHaveBeenCalled();
        expect(setIdempotencyKey).not.toHaveBeenCalled();
    });

    test("generates and stores one idempotency key when the compose state is missing it", () => {
        const setIdempotencyKey = jest.fn();
        const generate = jest.fn(() => "11111111-1111-4111-8111-111111111111");

        const result = ensureComposerIdempotencyKey(null, setIdempotencyKey, generate);

        expect(result).toBe("11111111-1111-4111-8111-111111111111");
        expect(generate).toHaveBeenCalledTimes(1);
        expect(setIdempotencyKey).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    });
});
