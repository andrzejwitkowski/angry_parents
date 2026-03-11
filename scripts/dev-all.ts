import { spawn } from "node:child_process";

export function parseDevAllOptions(args: string[]) {
    let runtime = "bun";
    let clear = false;
    let demo = false;

    for (const arg of args) {
        if (arg === "--clear") {
            clear = true;
            continue;
        }

        if (arg === "--demo") {
            demo = true;
            continue;
        }

        runtime = arg;
    }

    return { runtime, clear, demo };
}

export function buildDevCommands(runtime = "bun") {
    return {
        frontend: [runtime, "run", "dev:frontend"],
        backend: [runtime, "run", "dev:backend"],
    };
}

export async function waitForHttp(url: string, timeoutMs = 30000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for ${url}`);
}

export async function bootstrapCleanDevData(
    runtime: string,
    dependencies: {
        spawnProcess?: typeof spawn;
        fetchImpl?: typeof fetch;
        waitForHttpFn?: typeof waitForHttp;
        includeDemoChild?: boolean;
    } = {}
) {
    const spawnProcess = dependencies.spawnProcess ?? spawn;
    const fetchImpl = dependencies.fetchImpl ?? fetch;
    const waitForHttpFn = dependencies.waitForHttpFn ?? waitForHttp;
    const seedEndpoint = dependencies.includeDemoChild
        ? "http://127.0.0.1:3000/api/test/dev/seed-mock-family-demo"
        : "http://127.0.0.1:3000/api/test/dev/seed-mock-family";
    const backend = spawnProcess(runtime, ["run", "dev:backend"], {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: {
            ...process.env,
            ENABLE_TEST_ENDPOINTS: "true"
        }
    });

    const waitForBackendExit = () => new Promise<void>((resolve) => {
        if (typeof (backend as { once?: unknown }).once !== "function") {
            resolve();
            return;
        }

        (backend as { once: (event: string, listener: () => void) => void }).once("exit", () => resolve());
    });

    try {
        await waitForHttpFn("http://127.0.0.1:3000/api/health");

        const clearResponse = await fetchImpl("http://127.0.0.1:3000/api/test/database", {
            method: "DELETE"
        });

        if (!clearResponse.ok) {
            throw new Error(`Database reset failed with status ${clearResponse.status}`);
        }

        const seedResponse = await fetchImpl(seedEndpoint, {
            method: "POST"
        });

        if (!seedResponse.ok) {
            throw new Error(`Mock family seed failed with status ${seedResponse.status}`);
        }
    } finally {
        backend.kill();
        await waitForBackendExit();
    }
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
    const { runtime, clear, demo } = parseDevAllOptions(process.argv.slice(2));
    await runDbUp(runtime);

    if (clear) {
        await bootstrapCleanDevData(runtime, { includeDemoChild: demo });
    }

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
