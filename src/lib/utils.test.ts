import { expect, test } from "bun:test";
import { cn } from "./utils";

test("cn merges classes correctly", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", { b: true, c: false })).toBe("a b");
    expect(cn("px-2 py-2", "px-4")).toBe("py-2 px-4"); // tailwind-merge in action
});
