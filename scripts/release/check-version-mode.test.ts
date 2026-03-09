import { describe, expect, test } from "bun:test";
import { validateVersionMode } from "./check-version-mode";

describe("validateVersionMode", () => {
    test("accepts final versions on main", () => {
        expect(validateVersionMode("main", "1.2.3")).toEqual({ valid: true });
    });

    test("rejects snapshot versions on main", () => {
        expect(validateVersionMode("main", "1.2.3-SNAPSHOT")).toEqual({
            valid: false,
            message: "Branch 'main' must use a final version without -SNAPSHOT.",
        });
    });

    test("accepts snapshot versions on non-main branches", () => {
        expect(validateVersionMode("feat/test", "1.2.3-SNAPSHOT")).toEqual({ valid: true });
    });

    test("rejects final versions on non-main branches", () => {
        expect(validateVersionMode("fix/test", "1.2.3")).toEqual({
            valid: false,
            message: "Branch 'fix/test' must use a -SNAPSHOT version outside main.",
        });
    });

    test("rejects invalid semver strings", () => {
        expect(validateVersionMode("feat/test", "1.2")).toEqual({
            valid: false,
            message: "Version '1.2' must match X.Y.Z or X.Y.Z-SNAPSHOT.",
        });
    });
});
