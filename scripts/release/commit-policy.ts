import { spawnSync } from "node:child_process";

type ValidationResult = {
    valid: boolean;
    message?: string;
};

const ALLOWED_TYPES = ["feat", "fix", "bugfix", "docs", "chore", "refactor", "test", "ci"] as const;
const HEADER_PATTERN = new RegExp(`^(${ALLOWED_TYPES.join("|")})(\\([^\\n)]+\\))?(!)?: .+`);

export function validateCommitMessage(message: string): ValidationResult {
    const normalizedMessage = message.trim();
    const [header] = normalizedMessage.split(/\r?\n/, 1);

    if (!header || !header.includes(":")) {
        return {
            valid: false,
            message: "Commit header must match <type>(optional-scope): subject or <type>!: subject.",
        };
    }

    const typeMatch = header.match(/^([a-z]+)(?:\(|!|:)/);
    if (!typeMatch || !ALLOWED_TYPES.includes(typeMatch[1] as (typeof ALLOWED_TYPES)[number])) {
        return {
            valid: false,
            message: `Commit header must use one of: ${ALLOWED_TYPES.join(", ")}.`,
        };
    }

    if (!HEADER_PATTERN.test(header)) {
        return {
            valid: false,
            message: "Commit header must match <type>(optional-scope): subject or <type>!: subject.",
        };
    }

    return { valid: true };
}

function readCommitMessageFromFile(filePath: string): Promise<string> {
    return Bun.file(filePath).text();
}

function readCommitMessagesFromRange(range: string): string[] {
    const result = spawnSync("git", ["log", range, "--format=%B%x1f"], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `Failed to read commits for range '${range}'.`);
    }

    return result.stdout
        .split("\u001f")
        .map((message) => message.trim())
        .filter(Boolean);
}

async function checkMessage(message: string) {
    const result = validateCommitMessage(message);
    if (!result.valid) {
        throw new Error(result.message);
    }
}

async function main() {
    const [command, ...args] = process.argv.slice(2);

    if (command === "check-file") {
        const filePath = args[0];

        if (!filePath) {
            throw new Error("Usage: bun scripts/release/commit-policy.ts check-file <path>");
        }

        await checkMessage(await readCommitMessageFromFile(filePath));
        console.log("Commit message policy OK.");
        return;
    }

    if (command === "check-range") {
        const range = args[0];

        if (!range) {
            throw new Error("Usage: bun scripts/release/commit-policy.ts check-range <git-range>");
        }

        for (const message of readCommitMessagesFromRange(range)) {
            await checkMessage(message);
        }

        console.log(`Commit policy OK for range ${range}.`);
        return;
    }

    if (command === "check-head") {
        const result = spawnSync("git", ["log", "-1", "--format=%B"], {
            encoding: "utf8",
        });

        if (result.status !== 0) {
            throw new Error(result.stderr.trim() || "Failed to read HEAD commit message.");
        }

        await checkMessage(result.stdout);
        console.log("HEAD commit policy OK.");
        return;
    }

    throw new Error("Usage: bun scripts/release/commit-policy.ts <check-file|check-range|check-head> ...");
}

if (import.meta.main) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "Unknown commit policy error.");
        process.exit(1);
    });
}
