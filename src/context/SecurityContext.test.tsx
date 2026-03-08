import { expect, test, describe, beforeEach, afterEach, jest, mock } from "bun:test";
import React from 'react';
import { render, act, screen, cleanup } from '@testing-library/react';
import { SecurityProvider, useSecurity } from './SecurityContext';

// Mock dependencies
mock.module('@/lib/idb-crypto', () => ({
    clearPrivateKey: jest.fn().mockResolvedValue(undefined),
}));

mock.module('@/lib/api/auth', () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    },
}));

// Dummy component to test the context
const TestComponent = () => {
    const { timeRemaining, isLocked, resetTimer, updateConfig, ensureUnlocked } = useSecurity();
    return (
        <div>
            <div data-testid="time">{timeRemaining}</div>
            <div data-testid="locked">{isLocked.toString()}</div>
            <button onClick={resetTimer} data-testid="reset">Reset</button>
            <button onClick={() => updateConfig(30)} data-testid="config">Config</button>
            <button onClick={ensureUnlocked} data-testid="guard">Guard</button>
        </div>
    );
};

describe("SecurityContext", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        jest.useRealTimers();
    });

    test("initializes with default timeout", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });
        expect(screen.getByTestId("time").textContent).toBe("600");
        expect(screen.getByTestId("locked").textContent).toBe("false");
    });

    test("decrements timer every second", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId("time").textContent).toBe("599");

        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        expect(screen.getByTestId("time").textContent).toBe("594");
    });

    test("locks session when timer reaches zero", async () => {
        const { clearPrivateKey } = await import('@/lib/idb-crypto');

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        // Wait for initial getMe load (currentUserId)
        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            jest.advanceTimersByTime(610000); // 10 minutes
        });

        // Small flush after timer advance to trigger any remaining state updates
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId("time").textContent).toBe("0");
        expect(screen.getByTestId("locked").textContent).toBe("true");

        // Final flush for fire-and-forget clearPrivateKey
        await act(async () => {
            await Promise.resolve();
        });

        expect(clearPrivateKey).toHaveBeenCalled();
    });

    test("resets timer when resetTimer is called", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        expect(screen.getByTestId("time").textContent).toBe("590");

        await act(async () => {
            screen.getByTestId("reset").click();
        });
        expect(screen.getByTestId("time").textContent).toBe("600");
    });

    test("updates config and saves to localStorage", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        await act(async () => {
            screen.getByTestId("config").click();
        });
        expect(screen.getByTestId("time").textContent).toBe("30");
        expect(localStorage.getItem('session_timeout')).toBe("30");
    });

    test("ensureUnlocked resets timer if not locked", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        expect(screen.getByTestId("time").textContent).toBe("590");

        await act(async () => {
            screen.getByTestId("guard").click();
        });
        expect(screen.getByTestId("time").textContent).toBe("600");
    });
});
