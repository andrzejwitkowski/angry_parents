import { describe, test, expect, beforeEach, jest, mock } from "bun:test";
import { render, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { DayDetailsSheet } from "./DayDetailsSheet";
import { timelineApi } from "@/lib/api/timeline";

const securityState = {
    isLocked: false,
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("@/hooks/useChildren", () => ({
    useChildren: () => ({
        children: [],
    }),
}));

mock.module("@/components/ui/sheet", () => ({
    Sheet: ({ children }: any) => <div>{children}</div>,
    SheetContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <div>{children}</div>,
    SheetDescription: ({ children }: any) => <div>{children}</div>,
}));

describe("DayDetailsSheet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityState.isLocked = false;
    });

    test("closes immediately and skips fetch when session is locked", async () => {
        const onClose = jest.fn();
        const getByDateSpy = jest.spyOn(timelineApi, "getByDate").mockResolvedValue([] as any);
        securityState.isLocked = true;

        await act(async () => {
            render(
                <I18nextProvider i18n={i18n}>
                    <DayDetailsSheet
                        date={new Date("2026-03-09T12:00:00.000Z")}
                        isOpen={true}
                        onClose={onClose}
                        user={{ id: "user-1", email: "mom@example.com", name: "Mom", gender: "mom" } as any}
                    />
                </I18nextProvider>
            );
        });

        expect(onClose).toHaveBeenCalled();
        expect(getByDateSpy).not.toHaveBeenCalled();
    });
});
