import { spawn } from "bun";
import { MongoClient } from "mongodb";

const ROOT_DIR = "../../";
const TEST_MONGO_URI = "mongodb://localhost:27017/angry_parents_test";
const TEST_PORT = 3001;
const TEST_API_URL = `http://localhost:${TEST_PORT}`;

async function isPortOpen(port: number): Promise<boolean> {
    try {
        return new Promise((resolve) => {
            const socket = Bun.connect({
                hostname: "localhost",
                port: port,
                socket: {
                    open(socket) {
                        socket.end();
                        resolve(true);
                    },
                    data() { },
                    drain() { },
                    close() { },
                    error() {
                        resolve(false);
                    },
                    connectError() {
                        resolve(false);
                    },
                    end() {
                        resolve(true);
                    }
                },
            }).catch(() => resolve(false));
        });
    } catch {
        return false;
    }
}

async function waitForPort(port: number, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortOpen(port)) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function resetTestDb() {
    console.log("🧹 Resetting Test Database...");
    try {
        const client = new MongoClient(TEST_MONGO_URI);
        await client.connect();
        await client.db().dropDatabase();
        await client.close();
        console.log("✅ Test Database dropped.");
    } catch (e) {
        console.warn("⚠️ Warning: Failed to reset test database (might not exist yet):", e);
    }
}

async function startMongo() {
    console.log("Checking MongoDB (27017)...");
    if (await isPortOpen(27017)) {
        console.log("✅ MongoDB is already running.");
        return null;
    }

    console.log("🚀 Starting MongoDB via Docker...");
    const proc = spawn(["docker-compose", "up", "-d", "mongodb"], {
        cwd: "../../",
        stdout: "inherit",
        stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) throw new Error("Failed to start MongoDB");

    console.log("Waiting for MongoDB to be ready...");
    if (!await waitForPort(27017)) throw new Error("MongoDB failed to become ready");
    console.log("✅ MongoDB started.");
    return null;
}

async function killPort(port: number) {
    try {
        const proc = spawn(["lsof", "-t", "-i", `:${port}`]);
        const text = await new Response(proc.stdout).text();
        const pids = text.trim().split("\n").filter(Boolean);

        if (pids.length > 0) {
            console.log(`⚠️  Port ${port} is in use by PIDs: ${pids.join(", ")}. Killing...`);
            for (const pid of pids) {
                spawn(["kill", "-9", pid]);
            }
            // Wait for it to clear
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {
        console.warn("Failed to kill port:", e);
    }
}

async function startBackend() {
    console.log(`Checking Backend (${TEST_PORT})...`);

    // Always start fresh
    if (await isPortOpen(TEST_PORT)) {
        await killPort(TEST_PORT);
    }

    console.log("🚀 Starting Test Backend...");
    const proc = spawn(["bun", "run", "dev:backend"], {
        cwd: ROOT_DIR,
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            PORT: String(TEST_PORT),
            MONGODB_URI: TEST_MONGO_URI,
            BLOCKCHAIN_PRIVATE_KEY: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            SCHEDULER_POLL_INTERVAL: "100" // Fast polling for tests
        }
    });

    console.log("Waiting for Backend to be ready...");
    if (!await waitForPort(TEST_PORT)) {
        proc.kill();
        throw new Error("Backend failed to become ready");
    }
    console.log("✅ Backend started.");
    return proc;
}

async function runTests() {
    console.log("🧪 Running Tests...");
    const proc = spawn(["bun", "test"], {
        cwd: process.cwd(),
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            API_URL: TEST_API_URL
        }
    });

    return await proc.exited;
}

async function main() {
    try {
        await startMongo();
        await resetTestDb();
        const backendProc = await startBackend();

        // Give backend a moment to settle
        if (backendProc) await new Promise(r => setTimeout(r, 2000));

        const exitCode = await runTests();

        if (backendProc) {
            console.log("🛑 Stopping Backend...");
            backendProc.kill();
        }

        process.exit(exitCode);
    } catch (e) {
        console.error("Test Automation Failed:", e);
        process.exit(1);
    }
}

main();
