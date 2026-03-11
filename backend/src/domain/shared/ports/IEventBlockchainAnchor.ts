export interface PublishedHashResult {
    txHash: string;
    blockNumber: bigint;
}

export interface IEventBlockchainAnchor {
    publishHash(hash: string): Promise<PublishedHashResult>;
}
