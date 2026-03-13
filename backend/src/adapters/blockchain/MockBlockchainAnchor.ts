import { IBlockchainAnchor } from "../../domain/shared/ports/IBlockchainAnchor";
import { IEventBlockchainAnchor, type PublishedHashResult } from "../../domain/shared/ports/IEventBlockchainAnchor";

export class MockBlockchainAnchor implements IBlockchainAnchor, IEventBlockchainAnchor {
    private anchors = new Map<string, string>();
    private readonly hashPrefix = "a".repeat(64);
    private delayNextPublicationAttempt = false;
    private submitCount = 0;

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

    async submitHash(hash: string): Promise<string> {
        this.submitCount += 1;
        return this.anchorHash(hash);
    }

    async waitForPublication(txHash: string): Promise<PublishedHashResult> {
        if (this.delayNextPublicationAttempt) {
            this.delayNextPublicationAttempt = false;
            throw new Error(`Receipt for ${txHash} not available yet`);
        }

        return {
            txHash,
            blockNumber: BigInt(`0x${txHash.slice(2, 18)}`)
        };
    }

    async getReceipt(txHash: string): Promise<PublishedHashResult | null> {
        if (![...this.anchors.values()].includes(txHash)) {
            return null;
        }

        return this.waitForPublication(txHash);
    }

    async publishHash(hash: string): Promise<PublishedHashResult> {
        const txHash = await this.submitHash(hash);
        return this.waitForPublication(txHash);
    }

    async verifyAnchor(hash: string, txHash: string): Promise<boolean> {
        const storedTx = this.anchors.get(hash);
        const isValid = storedTx === txHash;
        console.log(`[MockBlockchain] Verifying hash ${hash} with tx ${txHash}: ${isValid}`);
        return isValid;
    }

    reset() {
        this.anchors.clear();
        this.delayNextPublicationAttempt = false;
        this.submitCount = 0;
        console.log("[MockBlockchain] Reset.");
    }

    delayNextReceipt() {
        this.delayNextPublicationAttempt = true;
    }

    getSubmitCount() {
        return this.submitCount;
    }
}
