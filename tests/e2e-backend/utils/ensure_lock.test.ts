import { afterEach, describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { acquireTestBackendStartupLock } from "./ensure";

const createdLockDirs: string[] = [];

afterEach(() => {
    for (const lockDir of createdLockDirs.splice(0)) {
        try {
            fs.rmdirSync(lockDir);
        } catch {
        }
    }
});

describe("acquireTestBackendStartupLock", () => {
    test("reclaims a stale lock directory instead of waiting forever", async () => {
        const lockDir = path.join(tmpdir(), `angry-e2e-ensure-lock-${process.pid}-${Date.now()}`);
        fs.mkdirSync(lockDir);
        createdLockDirs.push(lockDir);

        const staleAt = new Date(Date.now() - 10_000);
        fs.utimesSync(lockDir, staleAt, staleAt);

        const lock = await acquireTestBackendStartupLock({
            lockDir,
            staleAfterMs: 1_000,
            retryIntervalMs: 10,
            timeoutMs: 100,
            isBackendReady: async () => false,
        });

        expect(lock.kind).toBe("acquired");

        if (lock.kind !== "acquired") {
            throw new Error(`Expected lock acquisition, got ${lock.kind}`);
        }

        try {
            expect(fs.existsSync(lockDir)).toBe(true);
        } finally {
            lock.release();
        }
        expect(fs.existsSync(lockDir)).toBe(false);
    });

    test("refreshes the lock mtime while held so active startup does not look stale", async () => {
        const lockDir = path.join(tmpdir(), `angry-e2e-ensure-lock-heartbeat-${process.pid}-${Date.now()}`);
        createdLockDirs.push(lockDir);

        const lock = await acquireTestBackendStartupLock({
            lockDir,
            staleAfterMs: 5_000,
            retryIntervalMs: 10,
            timeoutMs: 100,
            isBackendReady: async () => false,
            heartbeatIntervalMs: 20,
        });

        if (lock.kind !== "acquired") {
            throw new Error(`Expected lock acquisition, got ${lock.kind}`);
        }

        try {
            const initialMtime = fs.statSync(lockDir).mtimeMs;
            await new Promise((resolve) => setTimeout(resolve, 60));
            const refreshedMtime = fs.statSync(lockDir).mtimeMs;

            expect(refreshedMtime).toBeGreaterThan(initialMtime);
        } finally {
            lock.release();
        }
    });
});
