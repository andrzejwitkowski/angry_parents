import { describe, expect, test } from "bun:test";
import { calculateReleaseBump, incrementVersion, parseCommitMessages } from "./versioning";

describe("calculateReleaseBump", () => {
    test("returns none when commits do not affect release version", () => {
        const bump = calculateReleaseBump([
            "docs: update readme",
            "chore: refresh tooling",
            "refactor: simplify auth wiring",
        ]);

        expect(bump).toBe("none");
    });

    test("returns patch for fix and bugfix commits", () => {
        const bump = calculateReleaseBump([
            "fix: handle empty token",
            "bugfix(api): stop duplicate requests",
        ]);

        expect(bump).toBe("patch");
    });

    test("returns minor when feature commits are present", () => {
        const bump = calculateReleaseBump([
            "fix: harden session cleanup",
            "feat(auth): add device approval",
        ]);

        expect(bump).toBe("minor");
    });

    test("returns major when commit header contains breaking marker", () => {
        const bump = calculateReleaseBump([
            "feat!: replace timeline payload shape",
        ]);

        expect(bump).toBe("major");
    });

    test("returns major when commit footer contains breaking change", () => {
        const bump = calculateReleaseBump([
            "fix(api): rename response field\n\nBREAKING CHANGE: clients must send the new shape",
        ]);

        expect(bump).toBe("major");
    });
});

describe("incrementVersion", () => {
    test("bumps patch and strips snapshot suffix", () => {
        expect(incrementVersion("1.2.3-SNAPSHOT", "patch")).toBe("1.2.4");
    });

    test("bumps minor and strips snapshot suffix", () => {
        expect(incrementVersion("1.2.3-SNAPSHOT", "minor")).toBe("1.3.0");
    });

    test("bumps major and strips snapshot suffix", () => {
        expect(incrementVersion("1.2.3-SNAPSHOT", "major")).toBe("2.0.0");
    });

    test("keeps final version when bump is none", () => {
        expect(incrementVersion("1.2.3-SNAPSHOT", "none")).toBe("1.2.3");
    });
});

describe("parseCommitMessages", () => {
    test("splits git log output into trimmed commit messages", () => {
        expect(parseCommitMessages("fix: one\u001ffeat: two\n\u001f")).toEqual(["fix: one", "feat: two"]);
    });
});
