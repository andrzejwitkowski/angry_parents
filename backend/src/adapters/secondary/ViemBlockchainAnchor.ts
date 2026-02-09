
import { createWalletClient, http, publicActions, parseEther, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon, base } from 'viem/chains'
import { IBlockchainAnchor } from '../../core/ports/IBlockchainAnchor'

export class ViemBlockchainAnchor implements IBlockchainAnchor {
    private client: any;
    private account: any;

    constructor() {
        const pk = process.env.BLOCKCHAIN_PRIVATE_KEY as `0x${string}`;
        if (!pk) {
            console.warn("BLOCKCHAIN_PRIVATE_KEY not set. Blockchain anchoring will fail.");
            return;
        }

        this.account = privateKeyToAccount(pk);

        // Default to Polygon for now, or make it configurable
        this.client = createWalletClient({
            account: this.account,
            chain: polygon,
            transport: http()
        }).extend(publicActions);
    }

    async anchorHash(hash: string): Promise<string> {
        if (!this.client) {
            throw new Error("Blockchain client not initialized");
        }

        try {
            // Send a 0 value transaction to self with the hash in data
            const txHash = await this.client.sendTransaction({
                to: this.account.address,
                value: 0n,
                data: toHex(hash)
            });
            return txHash;
        } catch (error) {
            console.error("Failed to anchor hash to blockchain", error);
            throw error;
        }
    }

    async verifyAnchor(hash: string, txHash: string): Promise<boolean> {
        if (!this.client) {
            throw new Error("Blockchain client not initialized");
        }

        try {
            const tx = await this.client.getTransaction({ hash: txHash as `0x${string}` });
            // Check if data matches the hash
            return tx.input === toHex(hash);
        } catch (error) {
            console.error("Failed to verify anchor", error);
            return false;
        }
    }
}
