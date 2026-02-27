import { spawn } from "bun";
import fs from "fs";
import { join } from "path";
import { tmpdir } from "os";

export const TEST_API_URL = "http://127.0.0.1:3002";
const TEST_PORT = 3002;
const LOCK_DIR = join(tmpdir(), "angry_e2e_lock_3002");

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

export async function ensureTestBackend() {
    process.env.API_URL = TEST_API_URL;

    if (await isPortOpen(TEST_PORT)) {
        return;
    }

    let haveLock = false;
    try {
        fs.mkdirSync(LOCK_DIR);
        haveLock = true;
    } catch { }

    if (haveLock) {
        try {
            if (!(await isPortOpen(27017))) {
                console.log("\n[E2E] Starting MongoDB via Docker...");
                spawn(["docker-compose", "up", "-d", "mongodb"], { cwd: new URL("../../../", import.meta.url).pathname }).unref();
                await waitForPort(27017);
            }

            console.log(`\n[E2E] Starting Isolated Test Backend on port ${TEST_PORT}...`);
            const sub = spawn(["bun", "run", "dev:backend"], {
                cwd: new URL("../../../", import.meta.url).pathname,
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
            await new Promise(r => setTimeout(r, 1000));
            console.log("[E2E] Backend API is ready!");
        } finally {
            try { fs.rmdirSync(LOCK_DIR); } catch { }
        }
    } else {
        if (!(await waitForPort(TEST_PORT, 30000))) {
            throw new Error("Timeout waiting for another worker to start the backend");
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}
