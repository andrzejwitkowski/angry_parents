import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function resolveHooksDir(): string {
    const result = spawnSync("git", ["rev-parse", "--git-path", "hooks"], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || "Failed to resolve git hooks directory.");
    }

    return result.stdout.trim();
}

function main() {
    const sourceDir = join(process.cwd(), "githooks");

    if (!existsSync(sourceDir)) {
        console.log("No githooks directory found; skipping hook installation.");
        return;
    }

    const hooksDir = resolveHooksDir();
    mkdirSync(hooksDir, { recursive: true });

    for (const fileName of readdirSync(sourceDir)) {
        const sourcePath = join(sourceDir, fileName);
        const targetPath = join(hooksDir, fileName);
        copyFileSync(sourcePath, targetPath);

        if (process.platform !== "win32") {
            chmodSync(targetPath, 0o755);
        }
    }

    console.log(`Installed git hooks to ${hooksDir}`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : "Unknown hook installation error.");
    process.exit(1);
}
