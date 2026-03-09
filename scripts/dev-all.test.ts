import { describe, expect, test } from "bun:test";
import { buildDevCommands } from "./dev-all";

describe("dev-all", () => {
    test("builds frontend and backend commands without shell syntax", () => {
        const commands = buildDevCommands("bun");

        expect(commands.frontend).toEqual(["bun", "run", "dev:frontend"]);
        expect(commands.backend).toEqual(["bun", "run", "dev:backend"]);
    });
});
