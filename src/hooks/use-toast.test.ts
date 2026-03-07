import { describe, it, expect } from "bun:test";
import { reducer } from "./use-toast";

describe("use-toast reducer", () => {
  it("returns current state for unknown action types", () => {
    const state = { toasts: [] };
    const next = reducer(state, { type: "UNKNOWN_ACTION" } as never);
    expect(next).toEqual(state);
  });
});
