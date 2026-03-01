import { MongoClient } from "mongodb";
import { spawn } from "bun";

const ROOT_DIR = new URL("../../../", import.meta.url).pathname;

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

async function runDockerMongoUp(): Promise<void> {
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
            const proc = spawn([cmd, ...args], { cwd: ROOT_DIR, stdout: "ignore", stderr: "ignore" });
            const exitCode = await proc.exited;
            if (exitCode === 0) return;
            lastError = new Error(`${cmd} exited with code ${exitCode}`);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to start MongoDB container");
}

export async function ensureMongo(uri: string, timeoutMs = 30000): Promise<void> {
    if (await canPingMongo(uri)) return;

    await runDockerMongoUp();

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await canPingMongo(uri)) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`MongoDB did not become ready within ${timeoutMs}ms`);
}
