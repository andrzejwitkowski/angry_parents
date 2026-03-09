import { describe, test, expect, beforeEach, afterEach, jest, mock } from "bun:test";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { TimelineEditDialog } from "./TimelineEditDialog";
import { timelineApi } from "@/lib/api/timeline";
import * as signatureProvider from "@/lib/signature-provider";

const securityState = {
    ensureUnlocked: jest.fn(() => false),
};

mock.module("@/context/SecurityContext", () => ({
    useSecurity: () => securityState,
}));

mock.module("../composer/forms/NoteForm", () => ({
    NoteForm: ({ onSubmit }: any) => (
        <button data-testid="submit-edit" onClick={() => onSubmit({ content: "edited" })}>Submit edit</button>
    ),
}));

describe("TimelineEditDialog", () => {
    let updateSpy: ReturnType<typeof jest.spyOn>;
    let signatureSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        signatureSpy = jest.spyOn(signatureProvider, "getMutationSignature").mockResolvedValue({ signature: "sig" } as any);
        updateSpy = jest.spyOn(timelineApi, "update").mockResolvedValue(undefined as any);
    });

    afterEach(() => {
        updateSpy.mockRestore();
        signatureSpy.mockRestore();
    });

    test("blocks update when session is locked", async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <TimelineEditDialog
                    open
                    onOpenChange={jest.fn()}
                    onSuccess={jest.fn()}
                    item={{
                        id: "item-1",
                        type: "NOTE",
                        date: "2026-03-11",
                        createdAt: "2026-03-11T10:00:00.000Z",
                        createdBy: "user-1",
                        createdByName: "Mom",
                        auditTrail: [],
                        isDeleted: false,
                        childIds: ["child-1"],
                        encryption: "PLAINTEXT",
                        content: "hello",
                    } as any}
                />
            </I18nextProvider>
        );

        await act(async () => {
            screen.getByTestId("submit-edit").click();
        });

        expect(securityState.ensureUnlocked).toHaveBeenCalled();
        expect(updateSpy).not.toHaveBeenCalled();
    });
});
