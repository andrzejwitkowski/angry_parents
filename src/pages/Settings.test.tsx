import { describe, test, expect, beforeEach, jest, mock } from "bun:test";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import Settings from "./Settings";

const securityState = {
    configTimeout: 600,
    updateConfig: jest.fn(),
    isLocked: false,
    isE2eeUnlocked: true,
    hasJustExpired: false,
    unlockSession: jest.fn(),
    clearExpiryFlag: jest.fn(),
    refreshE2eeSessionState: jest.fn().mockResolvedValue(true),
    ensureUnlocked: jest.fn(() => true),
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/components/ui/select", () => {
    const Select = ({ children }: any) => <div>{children}</div>;
    const SelectTrigger = ({ children }: any) => <div>{children}</div>;
    const SelectValue = ({ placeholder }: any) => <span>{placeholder}</span>;
    const SelectContent = ({ children }: any) => <div>{children}</div>;
    const SelectItem = ({ children, value }: any) => <div data-value={value}>{children}</div>;

    return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({
            user: { id: "user-1", email: "mom@example.com", name: "Mom", gender: "mom" },
            family: {
                parentPublicKeys: [
                    { parentId: "user-1", role: "mom", rsaPublicKeyBase64: "pub-1" },
                    { parentId: "user-2", role: "dad", rsaPublicKeyBase64: "pub-2" },
                ],
            },
        }),
    },
}));

mock.module("@/lib/webauthn-client", () => ({
    loginWithPasskey: jest.fn().mockResolvedValue(true),
}));

mock.module("@/lib/e2ee-session", () => ({
    hasStoredPrivateKey: jest.fn().mockResolvedValue(true),
}));

function renderSettings() {
    return render(
        <MemoryRouter>
            <I18nextProvider i18n={i18n}>
                <Settings />
            </I18nextProvider>
        </MemoryRouter>
    );
}

describe("Settings", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityState.isLocked = false;
        securityState.isE2eeUnlocked = true;
        securityState.hasJustExpired = false;
    });

    test("shows UNLOCKED when E2EE session is unlocked", async () => {
        await act(async () => {
            renderSettings();
        });

        expect(screen.getAllByText("Unlocked").length).toBeGreaterThan(0);
        expect(screen.queryByTestId("unlock-button")).toBeNull();
    });

    test("shows LOCKED and unlock button when session expired", async () => {
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.hasJustExpired = true;

        await act(async () => {
            renderSettings();
        });

        expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
        expect(screen.getByTestId("unlock-button")).toBeInTheDocument();
    });

    test("unlock button refreshes session state after passkey unlock", async () => {
        const { loginWithPasskey } = await import("@/lib/webauthn-client");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;

        await act(async () => {
            renderSettings();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("unlock-button"));
        });

        expect(loginWithPasskey).toHaveBeenCalledWith("mom@example.com");
        expect(securityState.refreshE2eeSessionState).toHaveBeenCalled();
        expect(securityState.unlockSession).toHaveBeenCalled();
        expect(securityState.clearExpiryFlag).toHaveBeenCalled();
    });

    test("shows error when unlock does not restore key", async () => {
        const { hasStoredPrivateKey } = await import("@/lib/e2ee-session");
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        (hasStoredPrivateKey as jest.Mock).mockResolvedValueOnce(false);

        await act(async () => {
            renderSettings();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("unlock-button"));
        });

        expect(screen.getByTestId("settings-unlock-error")).toBeInTheDocument();
        expect(securityState.unlockSession).not.toHaveBeenCalled();
    });
});
