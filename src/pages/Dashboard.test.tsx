import { describe, test, expect, beforeEach, jest, mock } from "bun:test";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import Dashboard from "./Dashboard";

const securityState = {
    ensureUnlocked: jest.fn(() => true),
    isLocked: false,
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/hooks/useChildren", () => ({
    useChildren: () => ({ children: [], refresh: jest.fn() }),
}));

mock.module("@/lib/api/auth", () => ({
    authApi: {
        getMe: jest.fn().mockResolvedValue({ user: { id: "user-1", name: "Mom", email: "mom@example.com" } }),
    },
}));

mock.module("@/lib/webauthn-client", () => ({
    checkHasPasskey: jest.fn().mockResolvedValue(true),
}));

mock.module("@/components/Sidebar", () => ({
    Sidebar: () => <div data-testid="sidebar" />,
}));

mock.module("@/components/BetterCalendar", () => ({
    BetterCalendar: () => <div data-testid="calendar" />,
}));

mock.module("@/components/settings/ChildrenConfigSheet", () => ({
    ChildrenConfigSheet: () => <div data-testid="children-config" />,
}));

mock.module("@/components/scheduler/CustodyWizard", () => ({
    CustodyScheduler: () => <div data-testid="custody-scheduler" />,
}));

mock.module("@/components/dashboard/CalendarLegendCard", () => ({
    CalendarLegendCard: () => <div data-testid="calendar-legend" />,
}));

describe("Dashboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityState.isLocked = false;
    });

    test("closes open scheduler when session locks", async () => {
        const { rerender } = render(
            <MemoryRouter>
                <I18nextProvider i18n={i18n}>
                    <Dashboard />
                </I18nextProvider>
            </MemoryRouter>
        );

        await act(async () => {
            await Promise.resolve();
        });

        await act(async () => {
            screen.getByText("Input Court Schedule").click();
        });

        expect(screen.getByTestId("custody-scheduler")).toBeInTheDocument();

        securityState.isLocked = true;

        await act(async () => {
            rerender(
                <MemoryRouter>
                    <I18nextProvider i18n={i18n}>
                        <Dashboard />
                    </I18nextProvider>
                </MemoryRouter>
            );
        });

        expect(screen.queryByTestId("custody-scheduler")).toBeNull();
    });
});
