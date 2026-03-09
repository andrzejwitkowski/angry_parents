import { expect, test, describe, beforeEach, afterEach, jest, mock } from "bun:test";
import React from 'react';
import { render, act, screen, cleanup } from '@testing-library/react';
import { SecurityProvider, useSecurity } from './SecurityContext';
import { timelineApi } from '@/lib/api/timeline';

// Mock dependencies
let storedKeyExists = false;

mock.module('@/lib/idb-crypto', () => ({
    getPrivateKey: jest.fn().mockResolvedValue(null),
    clearPrivateKey: jest.fn().mockResolvedValue(undefined),
}));

mock.module('@/lib/e2ee-session', () => ({
    hasStoredPrivateKey: jest.fn(async (userId?: string | null) => Boolean(userId) && storedKeyExists),
    clearActivePrivateKey: jest.fn(async (userId?: string | null) => {
        const { clearPrivateKey } = await import('@/lib/idb-crypto');
        if (!userId) return;
        storedKeyExists = false;
        await (clearPrivateKey as jest.Mock)(userId);
    }),
    markE2eeSessionLocked: jest.fn(),
    markE2eeSessionUnlocked: jest.fn(),
    setActiveE2eeUserId: jest.fn(),
}));

mock.module('@/lib/api/auth', () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    },
}));

// Dummy component to test the context
const TestComponent = () => {
    const {
        timeRemaining,
        isLocked,
        hasJustExpired,
        isE2eeUnlocked,
        resetTimer,
        lockForLogout,
        updateConfig,
        ensureUnlocked,
        refreshE2eeSessionState,
    } = useSecurity() as ReturnType<typeof useSecurity> & {
        isE2eeUnlocked: boolean;
        refreshE2eeSessionState: () => Promise<void>;
    };
    const [guardResult, setGuardResult] = React.useState<string>('untouched');
    return (
        <div>
            <div data-testid="time">{timeRemaining}</div>
            <div data-testid="locked">{isLocked.toString()}</div>
            <div data-testid="expired">{hasJustExpired.toString()}</div>
            <div data-testid="e2ee-unlocked">{isE2eeUnlocked.toString()}</div>
            <div data-testid="guard-result">{guardResult}</div>
            <button onClick={resetTimer} data-testid="reset">Reset</button>
            <button onClick={lockForLogout} data-testid="logout-lock">Logout lock</button>
            <button onClick={() => updateConfig(30)} data-testid="config">Config</button>
            <button onClick={() => setGuardResult(ensureUnlocked().toString())} data-testid="guard">Guard</button>
            <button onClick={() => void refreshE2eeSessionState()} data-testid="refresh-state">Refresh state</button>
        </div>
    );
};

describe("SecurityContext", () => {
    let clearDecryptionCachesSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        localStorage.clear();
        jest.useFakeTimers();
        jest.clearAllMocks();
        storedKeyExists = false;
        clearDecryptionCachesSpy = jest.spyOn(timelineApi, 'clearDecryptionCaches').mockImplementation(() => { });
    });

    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();
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
        expect(screen.getByTestId("locked").textContent).toBe("true");
        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("false");
    });

    test("does not auto-unlock on startup even if private key exists in IndexedDB", async () => {
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("false");
        expect(screen.getByTestId("locked").textContent).toBe("true");
    });

    test("decrements timer every second", async () => {
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId('refresh-state').click();
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
        storedKeyExists = true;

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
            screen.getByTestId('refresh-state').click();
        });

        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("true");

        await act(async () => {
            jest.advanceTimersByTime(610000); // 10 minutes
        });

        // Small flush after timer advance to trigger any remaining state updates
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId("time").textContent).toBe("0");
        expect(screen.getByTestId("locked").textContent).toBe("true");
        expect(screen.getByTestId("expired").textContent).toBe("true");
        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("false");

        // Final flush for fire-and-forget clearPrivateKey
        await act(async () => {
            await Promise.resolve();
        });

        expect(clearPrivateKey).toHaveBeenCalled();
        expect(clearDecryptionCachesSpy).toHaveBeenCalled();
    });

    test("refreshE2eeSessionState marks session unlocked after key restoration", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("false");
        storedKeyExists = true;

        await act(async () => {
            screen.getByTestId("refresh-state").click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("true");
        expect(screen.getByTestId("locked").textContent).toBe("false");
    });

    test("refreshE2eeSessionState clears expiry flag and restores timer after lock", async () => {
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        await act(async () => {
            jest.advanceTimersByTime(610000);
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByTestId("locked").textContent).toBe("true");
        expect(screen.getByTestId("expired").textContent).toBe("true");
        expect(screen.getByTestId("time").textContent).toBe("0");
        storedKeyExists = true;

        await act(async () => {
            screen.getByTestId("refresh-state").click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId("locked").textContent).toBe("false");
        expect(screen.getByTestId("expired").textContent).toBe("false");
        expect(screen.getByTestId("time").textContent).toBe("600");
        expect(screen.getByTestId("e2ee-unlocked").textContent).toBe("true");
    });

    test("refreshE2eeSessionState stays locked after timeout cleanup failure", async () => {
        const { clearActivePrivateKey } = await import('@/lib/e2ee-session');
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        (clearActivePrivateKey as jest.Mock).mockRejectedValueOnce(new Error('cleanup failed'));

        await act(async () => {
            jest.advanceTimersByTime(610000);
        });

        storedKeyExists = true;

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId('e2ee-unlocked').textContent).toBe('false');
        expect(screen.getByTestId('locked').textContent).toBe('true');
    });

    test("refreshE2eeSessionState stays locked after logout cleanup failure", async () => {
        const { clearActivePrivateKey } = await import('@/lib/e2ee-session');
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        (clearActivePrivateKey as jest.Mock).mockRejectedValueOnce(new Error('cleanup failed'));

        await act(async () => {
            screen.getByTestId('logout-lock').click();
        });

        storedKeyExists = true;

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(screen.getByTestId('e2ee-unlocked').textContent).toBe('false');
        expect(screen.getByTestId('locked').textContent).toBe('true');
    });

    test("resets timer when resetTimer is called", async () => {
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId('refresh-state').click();
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
        storedKeyExists = true;

        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        await act(async () => {
            screen.getByTestId('refresh-state').click();
        });

        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        expect(screen.getByTestId("time").textContent).toBe("590");

        await act(async () => {
            screen.getByTestId("guard").click();
        });
        expect(screen.getByTestId("time").textContent).toBe("600");
        expect(screen.getByTestId("guard-result").textContent).toBe("true");
    });

    test("ensureUnlocked blocks access when E2EE key is unavailable", async () => {
        await act(async () => {
            render(
                <SecurityProvider>
                    <TestComponent />
                </SecurityProvider>
            );
        });

        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        await act(async () => {
            screen.getByTestId("guard").click();
        });

        expect(screen.getByTestId("guard-result").textContent).toBe("false");
        expect(screen.getByTestId("locked").textContent).toBe("true");
    });
});
