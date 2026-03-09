import { spawn } from "node:child_process";

export function buildDevCommands(runtime = "bun") {
    return {
        frontend: [runtime, "run", "dev:frontend"],
        backend: [runtime, "run", "dev:backend"],
    };
}

async function runDbUp(runtime = "bun") {
    const child = spawn(runtime, ["scripts/db-compose.ts", "up"], {
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    const code = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (exitCode) => resolve(exitCode ?? 1));
    });

    if (code !== 0) {
        throw new Error(`Database startup failed with exit code ${code}`);
    }
}

async function main() {
    const runtime = process.argv[2] ?? "bun";
    await runDbUp(runtime);

    const commands = buildDevCommands(runtime);
    const frontend = spawn(commands.frontend[0], commands.frontend.slice(1), {
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    const backend = spawn(commands.backend[0], commands.backend.slice(1), {
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    const shutdown = () => {
        frontend.kill();
        backend.kill();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    const exitCode = await new Promise<number>((resolve, reject) => {
        frontend.once("error", reject);
        backend.once("error", reject);
        backend.once("exit", (code) => resolve(code ?? 0));
        frontend.once("exit", (code) => {
            if (code && code !== 0) {
                resolve(code);
            }
        });
    });

    shutdown();
    process.exit(exitCode);
}

if (import.meta.main) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "Failed to start dev processes.");
        process.exit(1);
    });
}
