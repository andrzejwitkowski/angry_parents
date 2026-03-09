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
    bootstrapDevSessionKey: jest.fn().mockResolvedValue("user-1"),
}));

mock.module("@/lib/environment", () => ({
    isDevEnvironment: jest.fn().mockReturnValue(false),
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
        expect(securityState.unlockSession).not.toHaveBeenCalled();
        expect(securityState.clearExpiryFlag).toHaveBeenCalled();
    });

    test("shows error when refreshE2eeSessionState reports failed unlock", async () => {
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.refreshE2eeSessionState.mockResolvedValueOnce(false);

        await act(async () => {
            renderSettings();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("unlock-button"));
        });

        expect(screen.getByTestId("settings-unlock-error")).toBeInTheDocument();
        expect(securityState.unlockSession).not.toHaveBeenCalled();
    });

    test("shows DEV simulated unlock button when locked in dev", async () => {
        const { isDevEnvironment } = await import("@/lib/environment");
        (isDevEnvironment as jest.Mock).mockReturnValue(true);
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;

        await act(async () => {
            renderSettings();
        });

        expect(screen.getByTestId("dev-unlock-button")).toBeInTheDocument();
    });

    test("DEV simulated unlock bootstraps session and unlocks", async () => {
        const { bootstrapDevSessionKey } = await import("@/lib/e2ee-session");
        const { isDevEnvironment } = await import("@/lib/environment");
        (isDevEnvironment as jest.Mock).mockReturnValue(true);
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;

        await act(async () => {
            renderSettings();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("dev-unlock-button"));
        });

        expect(bootstrapDevSessionKey).toHaveBeenCalledWith("user-1");
        expect(securityState.refreshE2eeSessionState).toHaveBeenCalled();
        expect(securityState.unlockSession).not.toHaveBeenCalled();
    });

    test("DEV simulated unlock shows error when refreshE2eeSessionState reports failure", async () => {
        const { isDevEnvironment } = await import("@/lib/environment");
        (isDevEnvironment as jest.Mock).mockReturnValue(true);
        securityState.isLocked = true;
        securityState.isE2eeUnlocked = false;
        securityState.refreshE2eeSessionState.mockResolvedValueOnce(false);

        await act(async () => {
            renderSettings();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("dev-unlock-button"));
        });

        expect(screen.getByTestId("settings-unlock-error")).toBeInTheDocument();
    });
});
