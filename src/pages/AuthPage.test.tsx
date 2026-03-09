import { describe, test, expect, beforeEach, jest, mock } from "bun:test";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import AuthPage from "./AuthPage";

const securityState = {
    refreshE2eeSessionState: jest.fn().mockResolvedValue(true),
    unlockSession: jest.fn(),
    clearExpiryFlag: jest.fn(),
    getCurrentUserId: jest.fn().mockReturnValue("user-1"),
};

mock.module("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
}));

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getInvitation: jest.fn(),
        devMockLogin: jest.fn().mockResolvedValue({ verified: true }),
    },
}));

mock.module("@/lib/webauthn-client", () => ({
    loginWithPasskey: jest.fn().mockResolvedValue(true),
    registerPasskey: jest.fn(),
}));

mock.module("@/lib/e2ee-session", () => ({
    bootstrapDevSessionKey: jest.fn().mockResolvedValue("user-1"),
    hasStoredPrivateKey: jest.fn().mockResolvedValue(true),
}));

mock.module("@/lib/environment", () => ({
    isDevEnvironment: jest.fn().mockReturnValue(false),
}));

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderAuthPage() {
    return render(
        <MemoryRouter initialEntries={["/auth"]}>
            <I18nextProvider i18n={i18n}>
                <Routes>
                    <Route path="/auth" element={<><AuthPage /><LocationProbe /></>} />
                    <Route path="/dashboard" element={<LocationProbe />} />
                </Routes>
            </I18nextProvider>
        </MemoryRouter>
    );
}

describe("AuthPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("login relies on refreshE2eeSessionState without redundant key lookup or manual unlock", async () => {
        const { loginWithPasskey } = await import("@/lib/webauthn-client");
        const { hasStoredPrivateKey } = await import("@/lib/e2ee-session");

        await act(async () => {
            renderAuthPage();
        });

        await act(async () => {
            fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mom@example.com" } });
        });

        await act(async () => {
            fireEvent.click(screen.getByText("Login with Key"));
        });

        expect(loginWithPasskey).toHaveBeenCalledWith("mom@example.com");
        expect(securityState.refreshE2eeSessionState).toHaveBeenCalled();
        expect(hasStoredPrivateKey).not.toHaveBeenCalled();
        expect(securityState.unlockSession).not.toHaveBeenCalled();
        expect(securityState.clearExpiryFlag).not.toHaveBeenCalled();
        expect(screen.getByTestId("location-probe").textContent).toBe("/dashboard");
    });
});
