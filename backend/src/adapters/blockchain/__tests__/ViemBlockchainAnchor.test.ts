import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { MockBlockchainAnchor } from "../MockBlockchainAnchor";

const calls: string[] = [];
const sendTransactionRequests: Array<Record<string, unknown>> = [];
const waitForReceiptRequests: Array<Record<string, unknown>> = [];

let selectedChain: { id: number; name: string } | undefined;
let selectedRpcUrl: string | undefined;
let nextReceiptBlockNumber = 123n;

mock.module("viem", () => ({
    createWalletClient: ({ account, chain }: { account: { address: string }; chain: { id: number; name: string } }) => ({
        extend() {
            selectedChain = chain;
            return {
                sendTransaction: async (request: Record<string, unknown>) => {
                    calls.push("sendTransaction");
                    sendTransactionRequests.push(request);
                    return "0xfeedface";
                },
                waitForTransactionReceipt: async (request: Record<string, unknown>) => {
                    calls.push("waitForTransactionReceipt");
                    waitForReceiptRequests.push(request);
                    return {
                        blockNumber: nextReceiptBlockNumber,
                        transactionHash: "0xfeedface"
                    };
                },
                getTransaction: async ({ hash }: { hash: string }) => ({
                    hash,
                    input: `0x${Buffer.from("event-proof-hash").toString("hex")}`
                }),
                account,
                chain
            };
        }
    }),
    http: (url?: string) => {
        selectedRpcUrl = url;
        return { url };
    },
    publicActions: {},
    toHex: (value: string) => `0x${Buffer.from(value).toString("hex")}`
}));

mock.module("viem/accounts", () => ({
    privateKeyToAccount: () => ({
        address: "0xabc123"
    })
}));

mock.module("viem/chains", () => ({
    polygon: { id: 137, name: "Polygon" },
    polygonAmoy: { id: 80002, name: "Polygon Amoy" }
}));

const { ViemBlockchainAnchor } = await import("../ViemBlockchainAnchor");
const { createBlockchainAnchor } = await import("../../../config/wireDependencies");

describe("ViemBlockchainAnchor", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        calls.length = 0;
        sendTransactionRequests.length = 0;
        waitForReceiptRequests.length = 0;
        selectedChain = undefined;
        selectedRpcUrl = undefined;
        nextReceiptBlockNumber = 123n;

        process.env.BLOCKCHAIN_PRIVATE_KEY = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        process.env.BLOCKCHAIN_RPC_URL = "https://rpc.example.test";
        process.env.NODE_ENV = "test";
        delete process.env.USE_MOCK_BLOCKCHAIN;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("rejects private keys without a 0x-prefixed hex value", () => {
        process.env.BLOCKCHAIN_PRIVATE_KEY = "not-hex";

        expect(() => new ViemBlockchainAnchor()).toThrow(
            "BLOCKCHAIN_PRIVATE_KEY must start with 0x and contain only hex characters"
        );
    });

    it("rejects missing rpc url configuration", () => {
        delete process.env.BLOCKCHAIN_RPC_URL;

        expect(() => new ViemBlockchainAnchor()).toThrow(
            "BLOCKCHAIN_RPC_URL is required for Viem blockchain anchoring"
        );
    });

    it("uses Polygon Amoy in test and Polygon mainnet in production", () => {
        new ViemBlockchainAnchor();
        expect(selectedChain).toEqual({ id: 80002, name: "Polygon Amoy" });

        process.env.NODE_ENV = "production";
        new ViemBlockchainAnchor();
        expect(selectedChain).toEqual({ id: 137, name: "Polygon" });
    });

    it("uses the configured rpc url and waits for the receipt before returning publishHash metadata", async () => {
        nextReceiptBlockNumber = 987n;
        const anchor = new ViemBlockchainAnchor();

        const result = await anchor.publishHash("event-proof-hash");

        expect(selectedRpcUrl).toBe("https://rpc.example.test");
        expect(calls).toEqual(["sendTransaction", "waitForTransactionReceipt"]);
        expect(sendTransactionRequests).toEqual([
            {
                to: "0xabc123",
                value: 0n,
                data: `0x${Buffer.from("event-proof-hash").toString("hex")}`
            }
        ]);
        expect(waitForReceiptRequests).toEqual([{ hash: "0xfeedface" }]);
        expect(result).toEqual({
            txHash: "0xfeedface",
            blockNumber: 987n
        });
    });

    it("keeps the legacy anchorHash and verifyAnchor forensic contract working", async () => {
        const anchor = new ViemBlockchainAnchor({
            privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY,
            rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
            nodeEnv: "test"
        });

        await expect(anchor.anchorHash("event-proof-hash")).resolves.toBe("0xfeedface");
        await expect(anchor.verifyAnchor("event-proof-hash", "0xfeedface")).resolves.toBe(true);
        await expect(anchor.verifyAnchor("different-hash", "0xfeedface")).resolves.toBe(false);
    });

    it("wireDependencies prefers the mock blockchain when USE_MOCK_BLOCKCHAIN is true", () => {
        const anchor = createBlockchainAnchor({
            ...process.env,
            NODE_ENV: "production",
            USE_MOCK_BLOCKCHAIN: "true"
        });

        expect(anchor).toBeInstanceOf(MockBlockchainAnchor);
    });

    it("wireDependencies allows Viem in test env when blockchain config is present", () => {
        const anchor = createBlockchainAnchor({
            ...process.env,
            NODE_ENV: "test",
            USE_MOCK_BLOCKCHAIN: "false",
            BLOCKCHAIN_PRIVATE_KEY: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            BLOCKCHAIN_RPC_URL: "https://rpc.example.test"
        });

        expect(anchor).toBeInstanceOf(ViemBlockchainAnchor);
    });
});
