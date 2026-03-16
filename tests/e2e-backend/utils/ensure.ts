import { spawn } from "bun";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { MongoClient } from "mongodb";

export const TEST_API_URL = "http://127.0.0.1:3002";
const TEST_PORT = 3002;
const LOCK_DIR = path.join(tmpdir(), "angry_e2e_lock_3002");

type StartupLockResult =
    | { kind: "acquired"; release: () => void }
    | { kind: "backend-ready" };

async function isPortOpen(port: number): Promise<boolean> {
    try {
        return await new Promise((resolve) => {
            Bun.connect({
                hostname: "127.0.0.1",
                port,
                socket: {
                    open(socket) { socket.end(); resolve(true); },
                    error() { resolve(false); }, connectError() { resolve(false); },
                    data() { }, drain() { }, close() { }, end() { resolve(true); }
                }
            }).catch(() => resolve(false));
        });
    } catch { return false; }
}

async function waitForPort(port: number, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortOpen(port)) return true;
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

async function wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

function lockAgeMs(lockDir: string): number {
    return Date.now() - fs.statSync(lockDir).mtimeMs;
}

export async function acquireTestBackendStartupLock({
    lockDir = LOCK_DIR,
    staleAfterMs = 30_000,
    retryIntervalMs = 500,
    timeoutMs = 30_000,
    heartbeatIntervalMs = 1_000,
    isBackendReady = () => isPortOpen(TEST_PORT),
}: {
    lockDir?: string;
    staleAfterMs?: number;
    retryIntervalMs?: number;
    timeoutMs?: number;
    heartbeatIntervalMs?: number;
    isBackendReady?: () => Promise<boolean>;
} = {}): Promise<StartupLockResult> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (await isBackendReady()) {
            return { kind: "backend-ready" };
        }

        try {
            fs.mkdirSync(lockDir);
            const heartbeat = setInterval(() => {
                try {
                    const now = new Date();
                    fs.utimesSync(lockDir, now, now);
                } catch {
                }
            }, heartbeatIntervalMs);
            heartbeat.unref?.();

            return {
                kind: "acquired",
                release: () => {
                    clearInterval(heartbeat);
                    try {
                        fs.rmdirSync(lockDir);
                    } catch {
                    }
                }
            };
        } catch {
            try {
                if (lockAgeMs(lockDir) >= staleAfterMs) {
                    fs.rmdirSync(lockDir);
                    continue;
                }
            } catch {
            }
        }

        await wait(retryIntervalMs);
    }

    if (await isBackendReady()) {
        return { kind: "backend-ready" };
    }

    throw new Error("Timeout waiting for another worker to start the backend");
}

async function canPingMongo(uri: string): Promise<boolean> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000 });
    try {
        await client.connect();
        await client.db().admin().command({ ping: 1 });
        return true;
    } catch {
        return false;
    } finally {
        await client.close().catch(() => undefined);
    }
}

async function startMongoViaDocker() {
    const cwd = path.resolve(import.meta.dir, "../../../");
    const commands: Array<[string, string[]]> = [
        ["docker", ["compose", "up", "-d", "mongodb"]],
        ["docker-compose", ["up", "-d", "mongodb"]],
    ];

    let lastError: unknown;
    for (const [cmd, args] of commands) {
        if (!Bun.which(cmd)) {
            continue;
        }
        try {
            const stderrLines: string[] = [];
            const proc = spawn([cmd, ...args], {
                cwd,
                stdout: "ignore",
                stderr: "pipe"
            });

            const reader = proc.stderr.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                stderrLines.push(new TextDecoder().decode(value));
            }

            const exitCode = await proc.exited;
            if (exitCode === 0) return;
            const errorMsg = stderrLines.join("").trim();
            lastError = new Error(`${cmd} exited with code ${exitCode}${errorMsg ? `: ${errorMsg}` : ""}`);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to start MongoDB via Docker");
}

export async function ensureTestBackend() {
    process.env.API_URL = TEST_API_URL;

    if (await isPortOpen(TEST_PORT)) {
        return;
    }

    const lock = await acquireTestBackendStartupLock();

    if (lock.kind === "acquired") {
        try {
            const mongoUri = "mongodb://127.0.0.1:27017/admin";
            if (!(await canPingMongo(mongoUri))) {
                console.log("\n[E2E] Starting MongoDB via Docker...");
                await startMongoViaDocker();
            }

            const mongoReadyStart = Date.now();
            while (!(await canPingMongo(mongoUri))) {
                if (Date.now() - mongoReadyStart > 30000) {
                    throw new Error("MongoDB did not become ready in time");
                }
                await new Promise(r => setTimeout(r, 500));
            }

            console.log(`\n[E2E] Starting Isolated Test Backend on port ${TEST_PORT}...`);
            const bunBin = Bun.which("bun");
            if (!bunBin) throw new Error("Could not find 'bun' executable");

            const sub = spawn([bunBin, "run", "dev:backend"], {
                cwd: path.resolve(import.meta.dir, "../../../"),
                stdout: "ignore", stderr: "ignore", // Prevent polluting test output
                env: {
                    ...process.env,
                    PORT: TEST_PORT.toString(),
                    MONGODB_URI: "mongodb://127.0.0.1:27017/angry_parents_e2e_auto",
                    NODE_ENV: "test",
                    E2E_TEST: "true",
                    BLOCKCHAIN_PRIVATE_KEY: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                }
            });
            sub.unref(); // Detach so it survives independently for future fast bun test runs

            if (!(await waitForPort(TEST_PORT, 30000))) {
                throw new Error("Backend failed to start on port " + TEST_PORT);
            }
            await wait(1000);
            console.log("[E2E] Backend API is ready!");
        } finally {
            lock.release();
        }
    } else {
        await wait(1000);
    }
}
