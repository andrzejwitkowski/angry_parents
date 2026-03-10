import { describe, expect, test } from "bun:test";
import { validateCommitMessage } from "./commit-policy";

describe("validateCommitMessage", () => {
    test("accepts release-relevant commit types", () => {
        expect(validateCommitMessage("feat(auth): add passkey recovery")).toEqual({ valid: true });
        expect(validateCommitMessage("fix: stop session leak")).toEqual({ valid: true });
        expect(validateCommitMessage("bugfix(api): avoid duplicate response")).toEqual({ valid: true });
    });

    test("accepts breaking change marker in header", () => {
        expect(validateCommitMessage("feat!: replace timeline payload")).toEqual({ valid: true });
    });

    test("accepts breaking marker for any allowed commit type", () => {
        expect(validateCommitMessage("refactor(core)!: replace release orchestration")).toEqual({ valid: true });
    });

    test("accepts footer-based breaking change", () => {
        expect(validateCommitMessage("fix(api): rename field\n\nBREAKING CHANGE: clients must use the new field")).toEqual({ valid: true });
    });

    test("accepts non-release commit types that are still allowed", () => {
        expect(validateCommitMessage("docs: update onboarding notes")).toEqual({ valid: true });
        expect(validateCommitMessage("chore: sync workflow names")).toEqual({ valid: true });
        expect(validateCommitMessage("ci: add release workflow summary")).toEqual({ valid: true });
    });

    test("rejects unsupported commit types", () => {
        expect(validateCommitMessage("style: reformat imports")).toEqual({
            valid: false,
            message: "Commit header must use one of: feat, fix, bugfix, docs, chore, refactor, test, ci.",
        });
    });

    test("rejects messages without conventional commit header", () => {
        expect(validateCommitMessage("quick fix")).toEqual({
            valid: false,
            message: "Commit header must match <type>(optional-scope): subject or <type>!: subject.",
        });
    });

    test("rejects empty subject", () => {
        expect(validateCommitMessage("fix:")).toEqual({
            valid: false,
            message: "Commit header must match <type>(optional-scope): subject or <type>!: subject.",
        });
    });
});
