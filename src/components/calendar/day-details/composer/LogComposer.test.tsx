import { describe, test, expect, beforeEach, afterEach, jest, mock } from "bun:test";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { LogComposer } from "./LogComposer";
import { timelineApi } from "@/lib/api/timeline";
import * as signatureProvider from "@/lib/signature-provider";

const securityState = {
    ensureUnlocked: jest.fn(() => false),
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("./ActionToolbar", () => ({
    ActionToolbar: ({ onModeSelect }: any) => (
        <button data-testid="mode-button" onClick={() => onModeSelect("NOTE")}>Mode</button>
    ),
}));

mock.module("./forms/NoteForm", () => ({
    NoteForm: ({ onSubmit }: any) => (
        <button data-testid="submit-note" onClick={() => onSubmit({ content: "hello" })}>Submit</button>
    ),
}));

describe("LogComposer", () => {
    let createSpy: ReturnType<typeof jest.spyOn>;
    let signatureSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        signatureSpy = jest.spyOn(signatureProvider, "getMutationSignature").mockResolvedValue({ signature: "sig" } as any);
        createSpy = jest.spyOn(timelineApi, "create").mockResolvedValue(undefined as any);
    });

    afterEach(() => {
        createSpy.mockRestore();
        signatureSpy.mockRestore();
    });

    test("blocks submit when session is locked", async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <LogComposer date="2026-03-11" onSuccess={jest.fn()} createdBy="user-1" childId="child-1" />
            </I18nextProvider>
        );

        await act(async () => {
            screen.getByTestId("mode-button").click();
        });

        await act(async () => {
            screen.getByTestId("submit-note").click();
        });

        expect(securityState.ensureUnlocked).toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test("submits selected childIds while preserving the primary childId", async () => {
        securityState.ensureUnlocked.mockReturnValue(true);

        mock.module("./forms/NoteForm", () => ({
            NoteForm: ({ onSubmit }: any) => (
                <button
                    data-testid="submit-note"
                    onClick={() => onSubmit({ content: "hello", childIds: ["child-1", "child-2"] })}
                >
                    Submit
                </button>
            ),
        }));

        const onSuccess = jest.fn();

        render(
            <I18nextProvider i18n={i18n}>
                <LogComposer date="2026-03-11" onSuccess={onSuccess} createdBy="user-1" childId="child-1" />
            </I18nextProvider>
        );

        await act(async () => {
            screen.getByTestId("mode-button").click();
        });

        await act(async () => {
            screen.getByTestId("submit-note").click();
        });

        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "NOTE",
                date: "2026-03-11",
                createdBy: "user-1",
                childId: "child-1",
                childIds: ["child-1", "child-2"],
            }),
            { signature: "sig" },
        );
        expect(onSuccess).toHaveBeenCalled();
    });
});
