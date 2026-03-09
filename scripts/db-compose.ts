import { spawnSync } from "node:child_process";

export type ComposeAction = "up" | "down";
export type ComposeRuntime = "podman" | "docker";

export function resolveComposeRuntime(commandExists: (command: string) => boolean): ComposeRuntime | null {
    if (commandExists("podman")) {
        return "podman";
    }

    if (commandExists("docker")) {
        return "docker";
    }

    return null;
}

export function getComposeArgs(action: ComposeAction): string[] {
    return action === "up" ? ["compose", "up", "-d"] : ["compose", "down"];
}

function commandExists(command: string): boolean {
    const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: process.platform === "win32" });
    return result.status === 0;
}

function spawnRuntime(runtime: ComposeRuntime, args: string[]): number {
    const result = spawnSync(runtime, args, { stdio: "inherit", shell: process.platform === "win32" });
    return result.status ?? 1;
}

export function runCompose(
    action: ComposeAction,
    options: {
        commandExists?: (command: string) => boolean;
        runner?: (runtime: ComposeRuntime, args: string[]) => number;
    } = {}
): ComposeRuntime {
    const exists = options.commandExists ?? commandExists;
    const runner = options.runner ?? spawnRuntime;
    const runtime = resolveComposeRuntime(exists);

    if (!runtime) {
        throw new Error("Neither podman nor docker found. Please install one of them.");
    }

    const verb = action === "up" ? "Starting" : "Stopping";
    console.log(`[DB] ${verb} services with ${runtime === "podman" ? "Podman" : "Docker"} Compose...`);

    const exitCode = runner(runtime, getComposeArgs(action));
    if (exitCode !== 0) {
        throw new Error(`${runtime} compose ${action} failed with exit code ${exitCode}`);
    }

    const done = action === "up" ? "started" : "stopped";
    console.log(`[DB] Services ${done}.`);

    return runtime;
}

function main() {
    const action = process.argv[2];
    if (action !== "up" && action !== "down") {
        console.error("Usage: bun scripts/db-compose.ts <up|down>");
        process.exit(1);
    }

    runCompose(action);
}

if (import.meta.main) {
    try {
        main();
    } catch (error) {
        console.error(`[DB] ERROR: ${error instanceof Error ? error.message : "Unknown compose failure."}`);
        process.exit(1);
    }
}
