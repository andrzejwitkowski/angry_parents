import { describe, expect, it } from "bun:test"

describe("toast UI module", () => {
  it("loads radix toast primitives through the toast wrapper", async () => {
    const toastModule = await import("./toast")

    expect(toastModule.ToastProvider).toBeDefined()
    expect(toastModule.ToastViewport).toBeDefined()
    expect(toastModule.Toast).toBeDefined()
  })
})
