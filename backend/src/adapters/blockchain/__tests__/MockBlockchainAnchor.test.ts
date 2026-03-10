import { describe, expect, it } from "bun:test";
import { MockBlockchainAnchor } from "../MockBlockchainAnchor";

describe("MockBlockchainAnchor", () => {
    it("publishHash returns deterministic tx metadata for the same hash", async () => {
        const anchor = new MockBlockchainAnchor();

        const first = await anchor.publishHash("event-proof-hash");
        const second = await anchor.publishHash("event-proof-hash");

        expect(first).toEqual(second);
        expect(first.txHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(typeof first.blockNumber).toBe("bigint");
        expect(first.txHash).toBe(await anchor.anchorHash("event-proof-hash"));
    });

    it("verifyAnchor remains compatible with the legacy forensic contract", async () => {
        const anchor = new MockBlockchainAnchor();
        const txHash = await anchor.anchorHash("event-proof-hash");

        await expect(anchor.verifyAnchor("event-proof-hash", txHash)).resolves.toBe(true);
        await expect(anchor.verifyAnchor("different-hash", txHash)).resolves.toBe(false);
    });
});
