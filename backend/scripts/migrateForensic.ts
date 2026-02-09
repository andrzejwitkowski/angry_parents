
import { ForensicChain } from "../src/core/domain/forensic/ForensicChain";
import { ForensicDocument } from "../src/core/domain/forensic/ForensicDocument";

// Mock Historical Data Provider
const getHistoricalEntriesHash = async () => {
    // In real app: Fetch all rows from SQL/Mongo before migration
    const historicalData = [
        { id: "old_1", content: " Legacy 1" },
        { id: "old_2", content: " Legacy 2" }
    ];
    // Calculate single hash of all history
    const canonical = ForensicChain.canonicalize(historicalData);
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(canonical);
    return hasher.digest("hex");
};

async function main() {
    console.log("Starting Forensic Migration...");

    // 1. Calculate History Hash
    const historyHash = await getHistoricalEntriesHash();
    console.log(`Historical Data Hash: ${historyHash}`);

    // 2. Create Genesis Block Payload
    // Index 0. prevHash = "GENESIS" or the history hash itself? 
    // "Jako content wpisz SHA256 wszystkich historycznych wpisów"
    // So Content = { historyHash }.

    // If we treat historyHash as the content of Genesis:
    const genesisContent = {
        migrationDate: new Date().toISOString(),
        legacyDataHash: historyHash,
        note: "System Genesis Block"
    };

    const genesisDoc = new ForensicDocument(
        0,
        genesisContent,
        "GENESIS_HASH", // First prevHash
        new Date().toISOString()
    );

    const payload = genesisDoc.toPayload();
    const docHash = await ForensicChain.calculateHash(payload);

    console.log("\n--- GENESIS BLOCK PREPARED ---");
    console.log(JSON.stringify(payload, null, 2));
    console.log(`\nDocument Hash to Sign: ${docHash}`);
    console.log("\nREQUIRED ACTION:");
    console.log(`User A (Key ID X) must sign '${docHash}'`);
    console.log(`User B (Admin Key ID Y) must sign '${docHash}'`);

    // In a real script, we would accept CLI args for signatures and save to DB.
    // For now, we output the instructions.
}

main().catch(console.error);
