import { beforeEach, describe, expect, jest, test } from "bun:test";
import { getComposeArgs, resolveComposeRuntime, runCompose } from "./db-compose";

describe("db-compose", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("prefers podman when both runtimes exist", () => {
        const commandExists = jest.fn((command: string) => command === "podman" || command === "docker");

        expect(resolveComposeRuntime(commandExists)).toBe("podman");
    });

    test("falls back to docker when podman is unavailable", () => {
        const commandExists = jest.fn((command: string) => command === "docker");

        expect(resolveComposeRuntime(commandExists)).toBe("docker");
    });

    test("returns null when no compose runtime exists", () => {
        expect(resolveComposeRuntime(() => false)).toBeNull();
    });

    test("builds compose args for up and down actions", () => {
        expect(getComposeArgs("up")).toEqual(["compose", "up", "-d"]);
        expect(getComposeArgs("down")).toEqual(["compose", "down"]);
    });

    test("runs compose action with resolved runtime", () => {
        const runner = jest.fn().mockReturnValue(0);

        const runtime = runCompose("up", {
            commandExists: (command) => command === "docker",
            runner,
        });

        expect(runtime).toBe("docker");
        expect(runner).toHaveBeenCalledWith("docker", ["compose", "up", "-d"]);
    });

    test("throws when no runtime is available", () => {
        expect(() => runCompose("down", {
            commandExists: () => false,
            runner: jest.fn(),
        })).toThrow("Neither podman nor docker found");
    });
});
