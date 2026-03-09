import { describe, test, expect, beforeEach, afterEach, jest, mock } from "bun:test";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { SidebarFooter } from "./SidebarFooter";

const securityState = {
    clearCurrentUserId: jest.fn(),
    lockForLogout: jest.fn(),
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        logout: jest.fn().mockResolvedValue(undefined),
    },
}));

mock.module("@/lib/e2ee-session", () => ({
    clearActivePrivateKey: jest.fn().mockResolvedValue(undefined),
    markE2eeSessionLocked: jest.fn(),
}));

mock.module("../security/SecurityTimer", () => ({
    SecurityTimer: () => <div data-testid="security-timer" />,
}));

describe("SidebarFooter", () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test("logout relies on lockForLogout for local E2EE cleanup", async () => {
        const { authApi } = await import("@/lib/api/auth");
        const { clearActivePrivateKey, markE2eeSessionLocked } = await import("@/lib/e2ee-session");

        render(
            <I18nextProvider i18n={i18n}>
                <SidebarFooter isCollapsed={false} />
            </I18nextProvider>
        );

        await act(async () => {
            screen.getByText("Logout").click();
        });

        expect(securityState.lockForLogout).toHaveBeenCalled();
        expect(markE2eeSessionLocked).not.toHaveBeenCalled();
        expect(clearActivePrivateKey).not.toHaveBeenCalled();
        expect(authApi.logout).toHaveBeenCalled();
    });

    test("logout still clears local user state when server logout fails", async () => {
        const { authApi } = await import("@/lib/api/auth");
        (authApi.logout as jest.Mock).mockRejectedValueOnce(new Error("logout failed"));

        render(
            <I18nextProvider i18n={i18n}>
                <SidebarFooter isCollapsed={false} />
            </I18nextProvider>
        );

        await act(async () => {
            screen.getByText("Logout").click();
        });

        expect(authApi.logout).toHaveBeenCalled();
        expect(securityState.clearCurrentUserId).toHaveBeenCalled();
    });
});
