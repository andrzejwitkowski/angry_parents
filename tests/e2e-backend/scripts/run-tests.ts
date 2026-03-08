import { spawn } from "bun";
import { MongoClient } from "mongodb";
import fs from "fs";
import { resolve } from "path";

const ROOT_DIR = resolve(import.meta.dir, "../../../");
const TEST_MONGO_URI = "mongodb://127.0.0.1:27017/angry_parents_test_e2e_isolated";
const TEST_PORT = 3002;
const TEST_API_URL = `http://127.0.0.1:${TEST_PORT}`;

async function isPortOpen(port: number): Promise<boolean> {
    try {
        return new Promise((resolve) => {
            const socket = Bun.connect({
                hostname: "127.0.0.1",
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
    const cmd = Bun.which("docker-compose") || Bun.which("docker");
    if (!cmd) throw new Error("Could not find 'docker-compose' or 'docker' executable");

    const args = cmd.includes("docker-compose") ? ["up", "-d", "mongodb"] : ["compose", "up", "-d", "mongodb"];

    const proc = spawn([cmd, ...args], {
        cwd: ROOT_DIR,
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
        let pids: string[] = [];
        if (process.platform === "win32") {
            const proc = spawn(["powershell", "-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess`]);
            const text = await new Response(proc.stdout).text();
            pids = text.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        } else {
            const proc = spawn(["lsof", "-t", "-i", `:${port}`]);
            const text = await new Response(proc.stdout).text();
            pids = text.trim().split("\n").filter(Boolean);
        }

        if (pids.length > 0) {
            console.log(`⚠️  Port ${port} is in use by PIDs: ${pids.join(", ")}. Killing...`);
            for (const pid of pids) {
                if (process.platform === "win32") {
                    spawn(["taskkill", "/PID", pid, "/F"]);
                } else {
                    spawn(["kill", "-9", pid]);
                }
            }
            // Wait for it to clear
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {
        console.warn("Failed to kill port:", e);
    }
}

async function startBackend(): Promise<any> {
    console.log(`Checking Backend (${TEST_PORT})...`);

    // Always start fresh
    if (await isPortOpen(TEST_PORT)) {
        await killPort(TEST_PORT);
    }

    console.log("🚀 Starting Test Backend...");
    const bunBin = Bun.which("bun");
    if (!bunBin) throw new Error("Could not find 'bun' executable");

    const proc = spawn([bunBin, "run", "dev:backend"], {
        cwd: ROOT_DIR,
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            PORT: TEST_PORT.toString(),
            MONGODB_URI: TEST_MONGO_URI,
            NODE_ENV: "test",
            E2E_TEST: "true",
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

async function runTests(): Promise<any> {
    // Create lock file for E2E mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fs as any).writeFileSync("e2e_mode.lock", "");

    // Run tests
    console.log("🧪 Running Tests...");
    const bunBin = Bun.which("bun");
    if (!bunBin) throw new Error("Could not find 'bun' executable");

    const proc = spawn([bunBin, "test", resolve(import.meta.dir, "..")], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            PORT: TEST_PORT.toString(),
            MONGODB_URI: TEST_MONGO_URI,
            NODE_ENV: "test",
            E2E_TEST: "true",
            BLOCKCHAIN_PRIVATE_KEY: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            SCHEDULER_POLL_INTERVAL: "100", // Fast polling for tests
            API_URL: TEST_API_URL
        }
    });

    return proc;
}

// Main Execution
async function main() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let backendProc: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let testProc: any;

    try {
        await startMongo();
        await resetTestDb();
        backendProc = await startBackend();

        // Give backend a moment to settle
        if (backendProc) await new Promise(r => setTimeout(r, 2000));

        testProc = await runTests();

        // Wait for tests to finish
        const exitCode = await testProc.exited;
        console.log(`Tests finished with code ${exitCode}`);

        // Remove lock file
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((fs as any).existsSync("e2e_mode.lock")) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (fs as any).unlinkSync("e2e_mode.lock");
            }
        } catch (e) {
            console.error("Failed to remove lock file", e);
        }

        if (backendProc) {
            console.log("🛑 Stopping Backend...");
            backendProc.kill();
        }
        process.exit(exitCode);

    } catch (e) {
        console.error("Test Automation Failed:", e);
        if (backendProc) {
            console.log("🛑 Stopping Backend due to error...");
            backendProc.kill();
        }
        if (testProc) {
            console.log("🛑 Stopping Test process due to error...");
            testProc.kill();
        }
        // Remove lock file on error too
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((fs as any).existsSync("e2e_mode.lock")) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (fs as any).unlinkSync("e2e_mode.lock");
            }
        } catch { }
        process.exit(1);
    }
}

main();
