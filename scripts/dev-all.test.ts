import { describe, expect, test } from "bun:test";
import { bootstrapCleanDevData, buildDevCommands, parseDevAllOptions } from "./dev-all";

describe("dev-all", () => {
    test("builds frontend and backend commands without shell syntax", () => {
        const commands = buildDevCommands("bun");

        expect(commands.frontend).toEqual(["bun", "run", "dev:frontend"]);
        expect(commands.backend).toEqual(["bun", "run", "dev:backend"]);
    });

    test("parses clear mode flag for clean bootstrap flow", () => {
        expect(parseDevAllOptions(["--clear"])).toEqual({
            runtime: "bun",
            clear: true,
            demo: false,
        });
    });

    test("parses runtime positional argument without enabling clear mode", () => {
        expect(parseDevAllOptions(["node"])).toEqual({
            runtime: "node",
            clear: false,
            demo: false,
        });
    });

    test("parses demo flag for clear bootstrap with child seed", () => {
        expect(parseDevAllOptions(["--clear", "--demo"])).toEqual({
            runtime: "bun",
            clear: true,
            demo: true,
        });
    });

    test("bootstrap clean mode resets db and seeds mock family", async () => {
        const calls: Array<{ url: string; method: string }> = [];
        let killed = false;

        await bootstrapCleanDevData("bun", {
            spawnProcess: (() => ({
                kill: () => {
                    killed = true;
                }
            })) as any,
            waitForHttpFn: (async (url: string) => {
                calls.push({ url, method: "GET" });
            }) as any,
            fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
                calls.push({ url: String(url), method: init?.method ?? "GET" });
                return new Response(null, { status: 200 });
            }) as typeof fetch
        });

        expect(calls).toEqual([
            { url: "http://127.0.0.1:3000/api/health", method: "GET" },
            { url: "http://127.0.0.1:3000/api/test/database", method: "DELETE" },
            { url: "http://127.0.0.1:3000/api/test/dev/seed-mock-family", method: "POST" }
        ]);
        expect(killed).toBe(true);
    });

    test("bootstrap demo mode seeds demo child endpoint", async () => {
        const calls: Array<{ url: string; method: string }> = [];

        await bootstrapCleanDevData("bun", {
            includeDemoChild: true,
            spawnProcess: (() => ({
                kill: () => {}
            })) as any,
            waitForHttpFn: (async () => {}) as any,
            fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
                calls.push({ url: String(url), method: init?.method ?? "GET" });
                return new Response(null, { status: 200 });
            }) as typeof fetch
        });

        expect(calls[calls.length - 1]).toEqual({
            url: "http://127.0.0.1:3000/api/test/dev/seed-mock-family-demo",
            method: "POST"
        });
    });
});
