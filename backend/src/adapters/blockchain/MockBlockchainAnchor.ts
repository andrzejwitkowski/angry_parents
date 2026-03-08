import { IBlockchainAnchor } from "../../domain/shared/ports/IBlockchainAnchor";

export class MockBlockchainAnchor implements IBlockchainAnchor {
    private anchors = new Map<string, string>();
    private readonly hashPrefix = "a".repeat(64);

    private toMockTxHash(hash: string): string {
        const normalized = hash.replace(/^0x/, "").toLowerCase().replace(/[^0-9a-f]/g, "");
        const seeded = (normalized + this.hashPrefix).slice(0, 64);
        return `0x${seeded}`;
    }

    async anchorHash(hash: string): Promise<string> {
        const txHash = this.toMockTxHash(hash);
        this.anchors.set(hash, txHash);
        console.log(`[MockBlockchain] Anchored hash ${hash} with tx ${txHash}`);
        return txHash;
    }

    async verifyAnchor(hash: string, txHash: string): Promise<boolean> {
        const storedTx = this.anchors.get(hash);
        const isValid = storedTx === txHash;
        console.log(`[MockBlockchain] Verifying hash ${hash} with tx ${txHash}: ${isValid}`);
        return isValid;
    }

    reset() {
        this.anchors.clear();
        console.log("[MockBlockchain] Reset.");
    }
}
