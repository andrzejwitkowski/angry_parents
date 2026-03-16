import { createWalletClient, http, publicActions, toHex, type WalletClient, type PublicActions, type Transport, type Chain, type LocalAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";
import { IBlockchainAnchor } from "../../domain/shared/ports/IBlockchainAnchor";
import { IEventBlockchainAnchor, type PublishedHashResult } from "../../domain/shared/ports/IEventBlockchainAnchor";

type SupportedBlockchainChain = "polygon" | "amoy";

type BlockchainAnchorConfig = {
    privateKey?: string;
    rpcUrl?: string;
    blockchainChain?: SupportedBlockchainChain;
};

function resolveBlockchainChain(chainName: SupportedBlockchainChain): Chain {
    return chainName === "amoy" ? polygonAmoy : polygon;
}

function isMissingReceiptError(error: unknown): boolean {
    const visited = new Set<unknown>();
    const queue: unknown[] = [error];
    const missingReceiptMarkers = [
        "receipt not found",
        "transaction receipt not found",
        "could not find transaction receipt",
        "transaction receipt with hash",
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current)) {
            continue;
        }
        visited.add(current);

        if (typeof current === "string") {
            const normalized = current.toLowerCase();
            if (missingReceiptMarkers.some((marker) => normalized.includes(marker))) {
                return true;
            }
            continue;
        }

        if (current instanceof Error) {
            queue.push(current.name, current.message, (current as Error & { cause?: unknown }).cause);
            continue;
        }

        if (typeof current === "object") {
            const record = current as Record<string, unknown>;
            queue.push(record.name, record.message, record.shortMessage, record.details, record.cause);
        }
    }

    return false;
}

export class ViemBlockchainAnchor implements IBlockchainAnchor, IEventBlockchainAnchor {
    private client: (WalletClient<Transport, Chain, LocalAccount> & PublicActions<Transport, Chain, LocalAccount>) | undefined;
    private account: LocalAccount | undefined;

    constructor(config: BlockchainAnchorConfig = {}) {
        const pk = config.privateKey ?? process.env.BLOCKCHAIN_PRIVATE_KEY;
        if (!pk) {
            console.warn("BLOCKCHAIN_PRIVATE_KEY not set. Blockchain anchoring will fail.");
            return;
        }

        if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
            throw new Error("BLOCKCHAIN_PRIVATE_KEY must be a 32-byte hex string prefixed with 0x");
        }

        const rpcUrl = config.rpcUrl ?? process.env.BLOCKCHAIN_RPC_URL;
        if (!rpcUrl) {
            throw new Error("BLOCKCHAIN_RPC_URL is required for Viem blockchain anchoring");
        }

        const blockchainChain = config.blockchainChain ?? (process.env.BLOCKCHAIN_CHAIN as SupportedBlockchainChain | undefined);
        if (blockchainChain !== "polygon" && blockchainChain !== "amoy") {
            throw new Error("BLOCKCHAIN_CHAIN is required for Viem blockchain anchoring");
        }

        const chain = resolveBlockchainChain(blockchainChain);

        this.account = privateKeyToAccount(pk as `0x${string}`);

        this.client = createWalletClient({
            account: this.account,
            chain,
            transport: http(rpcUrl)
        }).extend(publicActions);
    }

    async publishHash(hash: string): Promise<PublishedHashResult> {
        try {
            const txHash = await this.submitHash(hash);
            return this.waitForPublication(txHash);
        } catch (error) {
            console.error("Failed to anchor hash to blockchain", error);
            throw error;
        }
    }

    async submitHash(hash: string): Promise<string> {
        const client = this.client;
        const account = this.account;

        if (!client || !account) {
            throw new Error("Blockchain client not initialized");
        }

        return client.sendTransaction({
            to: account.address,
            value: 0n,
            data: toHex(hash)
        });
    }

    async waitForPublication(txHash: string): Promise<PublishedHashResult> {
        const client = this.client;
        if (!client) {
            throw new Error("Blockchain client not initialized");
        }

        const receipt = await client.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

        return {
            txHash,
            blockNumber: receipt.blockNumber
        };
    }

    async getReceipt(txHash: string): Promise<PublishedHashResult | null> {
        const client = this.client;
        if (!client) {
            throw new Error("Blockchain client not initialized");
        }

        try {
            const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
            return {
                txHash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            if (isMissingReceiptError(error)) {
                return null;
            }

            throw error;
        }
    }

    async anchorHash(hash: string): Promise<string> {
        const result = await this.publishHash(hash);
        return result.txHash;
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
