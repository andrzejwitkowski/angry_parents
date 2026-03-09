import { describe, test, expect, beforeEach, afterEach, jest, mock } from "bun:test";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { SessionExpiredDialog } from "./SessionExpiredDialog";

const securityState = {
    isLocked: false,
    isE2eeUnlocked: true,
    hasJustExpired: false,
    clearExpiryFlag: jest.fn(),
    refreshE2eeSessionState: jest.fn().mockResolvedValue(true),
    unlockSession: jest.fn(),
    lockForLogout: jest.fn(),
    clearCurrentUserId: jest.fn(),
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({
            user: { id: "user-1", email: "mom@example.com", name: "Mom", gender: "mom" },
            family: null,
        }),
        logout: jest.fn().mockResolvedValue(undefined),
    },
}));

mock.module("@/lib/webauthn-client", () => ({
    loginWithPasskey: jest.fn().mockResolvedValue(true),
}));

mock.module("@/lib/e2ee-session", () => ({
    hasStoredPrivateKey: jest.fn().mockResolvedValue(true),
    clearActivePrivateKey: jest.fn().mockResolvedValue(undefined),
    setActiveE2eeUserId: jest.fn(),
}));

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderDialog() {
    return render(
        <MemoryRouter initialEntries={["/"]}>
            <I18nextProvider i18n={i18n}>
                <Routes>
                    <Route path="*" element={<><SessionExpiredDialog /><LocationProbe /></>} />
                </Routes>
            </I18nextProvider>
        </MemoryRouter>
    );
}

describe("SessionExpiredDialog", () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        securityState.isLocked = false;
        securityState.isE2eeUnlocked = true;
        securityState.hasJustExpired = false;
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test("stays hidden when session has not expired", async () => {
        await act(async () => {
            renderDialog();
        });

        expect(screen.queryByRole("dialog", { name: "Session Expired" })).toBeNull();
    });

    test("opens when session just expired", async () => {
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;

        await act(async () => {
            renderDialog();
        });

        expect(screen.getByText("Session Expired")).toBeInTheDocument();
        expect(screen.getByTestId("session-expired-unlock")).toBeInTheDocument();
    });

    test("unlock action refreshes security state", async () => {
        const { loginWithPasskey } = await import("@/lib/webauthn-client");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;

        await act(async () => {
            renderDialog();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("session-expired-unlock"));
        });

        expect(loginWithPasskey).toHaveBeenCalledWith("mom@example.com");
        expect(securityState.refreshE2eeSessionState).toHaveBeenCalled();
        expect(securityState.unlockSession).not.toHaveBeenCalled();
        expect(securityState.clearExpiryFlag).toHaveBeenCalled();
    });

    test("shows error when refreshE2eeSessionState reports failed unlock", async () => {
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;
        securityState.refreshE2eeSessionState.mockResolvedValueOnce(false);

        await act(async () => {
            renderDialog();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("session-expired-unlock"));
        });

        expect(securityState.unlockSession).not.toHaveBeenCalled();
        expect(screen.getByTestId("session-expired-error")).toBeInTheDocument();
    });

    test("shows error when unlock fails", async () => {
        const { loginWithPasskey } = await import("@/lib/webauthn-client");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;
        (loginWithPasskey as jest.Mock).mockResolvedValueOnce(false);

        await act(async () => {
            renderDialog();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("session-expired-unlock"));
        });

        expect(screen.getByTestId("session-expired-error")).toBeInTheDocument();
    });

    test("logout still clears local state and redirects when server logout fails", async () => {
        const { authApi } = await import("@/lib/api/auth");
        const { clearActivePrivateKey } = await import("@/lib/e2ee-session");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;
        (authApi.logout as jest.Mock).mockRejectedValueOnce(new Error("network down"));

        await act(async () => {
            renderDialog();
        });

        await act(async () => {
            fireEvent.click(screen.getByText("Logout"));
        });

        expect(securityState.lockForLogout).toHaveBeenCalled();
        expect(clearActivePrivateKey).toHaveBeenCalledWith("user-1");
        expect(securityState.clearExpiryFlag).toHaveBeenCalled();
        expect(securityState.clearCurrentUserId).toHaveBeenCalled();
        expect(screen.getByTestId("location-probe").textContent).toBe("/auth");
    });
});
