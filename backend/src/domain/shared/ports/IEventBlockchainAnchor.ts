export interface PublishedHashResult {
    txHash: string;
    blockNumber: bigint;
}

export interface IEventBlockchainAnchor {
    submitHash(hash: string): Promise<string>;
    waitForPublication(txHash: string): Promise<PublishedHashResult>;
    getReceipt(txHash: string): Promise<PublishedHashResult | null>;
    publishHash(hash: string): Promise<PublishedHashResult>;
}
