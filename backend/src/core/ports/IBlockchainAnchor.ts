
export interface IBlockchainAnchor {
    anchorHash(hash: string): Promise<string>; // Returns txHash
    verifyAnchor(hash: string, txHash: string): Promise<boolean>;
}
