import { MongoClient } from "mongodb";
import { spawn } from "bun";
import path from "path";

const ROOT_DIR = path.resolve(import.meta.dir, "../../../");

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
            const stderrLines: string[] = [];
            const proc = spawn([cmd, ...args], {
                cwd: ROOT_DIR,
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
