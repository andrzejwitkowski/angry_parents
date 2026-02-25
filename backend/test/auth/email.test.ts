import { describe, expect, it } from "bun:test";

describe("Email (Console Only)", () => {
    it("should log email in dev mode", async () => {
        const originalEnv = process.env.NODE_ENV;

        process.env.NODE_ENV = "development";

        const consoleSpy = {
            log: [] as string[],
        };

        const originalLog = console.log;
        // @ts-ignore - spying
        console.log = (...args: unknown[]) => {
            consoleSpy.log.push(args.join(" "));
        };

        try {
            const { sendInvitationEmail } = await import("../../src/lib/email");

            const { link } = await sendInvitationEmail(
                "test@example.com",
                "test-token-123",
                "John Doe"
            );

            expect(link).toContain("test-token-123");
            expect(consoleSpy.log.some(l => l.includes("test@example.com"))).toBe(true);
            expect(consoleSpy.log.some(l => l.includes("DEV EMAIL"))).toBe(true);
        } finally {
            console.log = originalLog;
            process.env.NODE_ENV = originalEnv;
        }
    });

    it("should use custom frontend URL from env", async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalUrl = process.env.FRONTEND_URL;

        process.env.NODE_ENV = "development";
        process.env.FRONTEND_URL = "https://custom.app";

        const consoleSpy = {
            log: [] as string[],
        };

        const originalLog = console.log;
        // @ts-ignore - spying
        console.log = (...args: unknown[]) => {
            consoleSpy.log.push(args.join(" "));
        };

        try {
            const { sendInvitationEmail } = await import("../../src/lib/email");

            const { link } = await sendInvitationEmail(
                "test@example.com",
                "token-123",
                "Test User"
            );

            expect(link).toStartWith("https://custom.app");
        } finally {
            console.log = originalLog;
            process.env.NODE_ENV = originalEnv;
            process.env.FRONTEND_URL = originalUrl;
        }
    });
});
