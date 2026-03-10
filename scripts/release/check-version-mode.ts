import { spawnSync } from "node:child_process";

type ValidationResult = {
    valid: boolean;
    message?: string;
};

const VERSION_PATTERN = /^\d+\.\d+\.\d+(-SNAPSHOT)?$/;

export function validateVersionMode(branch: string, version: string): ValidationResult {
    if (!VERSION_PATTERN.test(version)) {
        return {
            valid: false,
            message: `Version '${version}' must match X.Y.Z or X.Y.Z-SNAPSHOT.`,
        };
    }

    const isSnapshot = version.endsWith("-SNAPSHOT");

    if (branch === "main" && isSnapshot) {
        return {
            valid: false,
            message: "Branch 'main' must use a final version without -SNAPSHOT.",
        };
    }

    if (branch !== "main" && !isSnapshot) {
        return {
            valid: false,
            message: `Branch '${branch}' must use a -SNAPSHOT version outside main.`,
        };
    }

    return { valid: true };
}

function getCurrentBranch(): string {
    const result = spawnSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || "Failed to detect current branch.");
    }

    return result.stdout.trim();
}

async function getPackageVersion(): Promise<string> {
    const packageJson = await Bun.file("package.json").json() as { version?: string };

    if (!packageJson.version) {
        throw new Error("package.json does not contain a version field.");
    }

    return packageJson.version;
}

function getArgValue(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
    const branch = getArgValue("--branch") || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || getCurrentBranch();
    const version = getArgValue("--version") || await getPackageVersion();
    const result = validateVersionMode(branch, version);

    if (!result.valid) {
        throw new Error(result.message);
    }

    console.log(`Version mode OK for branch '${branch}' with version '${version}'.`);
}

if (import.meta.main) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "Unknown version validation error.");
        process.exit(1);
    });
}
