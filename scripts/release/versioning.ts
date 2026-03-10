import { spawnSync } from "node:child_process";

export type ReleaseBump = "major" | "minor" | "patch" | "none";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(-SNAPSHOT)?$/;
const BREAKING_HEADER_PATTERN = /^[a-z]+(\([^\n)]+\))?!: .+/;
const BREAKING_FOOTER_PATTERN = /(^|\r?\n)BREAKING CHANGE: /;

function getCommitWeight(message: string): ReleaseBump {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
        return "none";
    }

    const [header] = normalizedMessage.split(/\r?\n/, 1);

    if (BREAKING_HEADER_PATTERN.test(header) || BREAKING_FOOTER_PATTERN.test(normalizedMessage)) {
        return "major";
    }

    if (/^feat(\([^\n)]+\))?:/.test(header)) {
        return "minor";
    }

    if (/^(fix|bugfix)(\([^\n)]+\))?:/.test(header)) {
        return "patch";
    }

    return "none";
}

export function calculateReleaseBump(commitMessages: string[]): ReleaseBump {
    let highest: ReleaseBump = "none";

    for (const message of commitMessages) {
        const bump = getCommitWeight(message);

        if (bump === "major") {
            return "major";
        }

        if (bump === "minor") {
            highest = "minor";
            continue;
        }

        if (bump === "patch" && highest === "none") {
            highest = "patch";
        }
    }

    return highest;
}

export function incrementVersion(version: string, bump: ReleaseBump): string {
    const match = version.match(SEMVER_PATTERN);

    if (!match) {
        throw new Error(`Version '${version}' must match X.Y.Z or X.Y.Z-SNAPSHOT.`);
    }

    let major = Number(match[1]);
    let minor = Number(match[2]);
    let patch = Number(match[3]);

    if (bump === "major") {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (bump === "minor") {
        minor += 1;
        patch = 0;
    } else if (bump === "patch") {
        patch += 1;
    }

    return `${major}.${minor}.${patch}`;
}

export function parseCommitMessages(output: string): string[] {
    return output
        .split("\u001f")
        .map((message) => message.trim())
        .filter(Boolean);
}

function readCommitMessagesFromRange(range: string): string[] {
    const result = spawnSync("git", ["log", range, "--format=%B%x1f"], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `Failed to read git log for range '${range}'.`);
    }

    return parseCommitMessages(result.stdout);
}

function main() {
    const [command, ...args] = process.argv.slice(2);

    if (command === "bump") {
        const range = args[0];

        if (!range) {
            throw new Error("Usage: bun scripts/release/versioning.ts bump <git-range>");
        }

        console.log(calculateReleaseBump(readCommitMessagesFromRange(range)));
        return;
    }

    if (command === "next-version") {
        const [version, bump] = args;

        if (!version || !bump || !["major", "minor", "patch", "none"].includes(bump)) {
            throw new Error("Usage: bun scripts/release/versioning.ts next-version <version> <major|minor|patch|none>");
        }

        console.log(incrementVersion(version, bump as ReleaseBump));
        return;
    }

    throw new Error("Usage: bun scripts/release/versioning.ts <bump|next-version> ...");
}

if (import.meta.main) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Unknown versioning error.");
        process.exit(1);
    }
}
