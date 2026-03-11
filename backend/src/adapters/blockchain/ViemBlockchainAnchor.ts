import { createWalletClient, http, publicActions, toHex, type WalletClient, type PublicActions, type Transport, type Chain, type LocalAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";
import { IBlockchainAnchor } from "../../domain/shared/ports/IBlockchainAnchor";
import { IEventBlockchainAnchor, type PublishedHashResult } from "../../domain/shared/ports/IEventBlockchainAnchor";

type BlockchainAnchorConfig = {
    privateKey?: string;
    rpcUrl?: string;
    nodeEnv?: string;
};

export class ViemBlockchainAnchor implements IBlockchainAnchor, IEventBlockchainAnchor {
    private client: (WalletClient<Transport, Chain, LocalAccount> & PublicActions<Transport, Chain, LocalAccount>) | undefined;
    private account: LocalAccount | undefined;

    constructor(config: BlockchainAnchorConfig = {}) {
        const pk = config.privateKey ?? process.env.BLOCKCHAIN_PRIVATE_KEY;
        if (!pk) {
            console.warn("BLOCKCHAIN_PRIVATE_KEY not set. Blockchain anchoring will fail.");
            return;
        }

        if (!/^0x[0-9a-fA-F]+$/.test(pk)) {
            throw new Error("BLOCKCHAIN_PRIVATE_KEY must start with 0x and contain only hex characters");
        }

        const rpcUrl = config.rpcUrl ?? process.env.BLOCKCHAIN_RPC_URL;
        if (!rpcUrl) {
            throw new Error("BLOCKCHAIN_RPC_URL is required for Viem blockchain anchoring");
        }

        const chain = (config.nodeEnv ?? process.env.NODE_ENV) === "test" ? polygonAmoy : polygon;

        this.account = privateKeyToAccount(pk as `0x${string}`);

        this.client = createWalletClient({
            account: this.account,
            chain,
            transport: http(rpcUrl)
        }).extend(publicActions);
    }

    private getInitializedClient() {
        const client = this.client;
        const account = this.account;

        if (!client || !account) {
            throw new Error("Blockchain client not initialized");
        }

        return { client, account };
    }

    private async sendHashTransaction(hash: string): Promise<`0x${string}`> {
        const { client, account } = this.getInitializedClient();

        return client.sendTransaction({
            to: account.address,
            value: 0n,
            data: toHex(hash)
        });
    }

    async publishHash(hash: string): Promise<PublishedHashResult> {
        try {
            const { client } = this.getInitializedClient();
            const txHash = await this.anchorHash(hash) as `0x${string}`;
            const receipt = await client.waitForTransactionReceipt({ hash: txHash });

            return {
                txHash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error("Failed to anchor hash to blockchain", error);
            throw error;
        }
    }

    async anchorHash(hash: string): Promise<string> {
        try {
            return await this.sendHashTransaction(hash);
        } catch (error) {
            console.error("Failed to anchor hash to blockchain", error);
            throw error;
        }
    }

    async verifyAnchor(hash: string, txHash: string): Promise<boolean> {
        const client = this.client;
        if (!client) {
            throw new Error("Blockchain client not initialized");
        }

        try {
            const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
            return tx.input === toHex(hash);
        } catch (error) {
            console.error("Failed to verify anchor", error);
            return false;
        }
    }
}
