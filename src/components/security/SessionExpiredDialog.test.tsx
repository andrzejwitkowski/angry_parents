import { describe, test, expect, beforeEach, jest, mock } from "bun:test";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
}));

function renderDialog() {
    return render(
        <MemoryRouter>
            <I18nextProvider i18n={i18n}>
                <SessionExpiredDialog />
            </I18nextProvider>
        </MemoryRouter>
    );
}

describe("SessionExpiredDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityState.isLocked = false;
        securityState.isE2eeUnlocked = true;
        securityState.hasJustExpired = false;
    });

    test("stays hidden when session has not expired", async () => {
        await act(async () => {
            renderDialog();
        });

        expect(screen.queryByText("Session expired")).toBeNull();
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
        expect(securityState.unlockSession).toHaveBeenCalled();
        expect(securityState.clearExpiryFlag).toHaveBeenCalled();
    });

    test("does not unlock session when key restoration check fails", async () => {
        const { hasStoredPrivateKey } = await import("@/lib/e2ee-session");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;
        (hasStoredPrivateKey as jest.Mock).mockResolvedValueOnce(false);

        await act(async () => {
            renderDialog();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("session-expired-unlock"));
        });

        expect(securityState.unlockSession).not.toHaveBeenCalled();
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
});
