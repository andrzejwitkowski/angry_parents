import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, jest, mock, beforeEach } from "bun:test";
import { AttachmentCard } from "./AttachmentCard";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { timelineApi } from "@/lib/api/timeline";

// Mock the API
// Mock the API
mock.module("@/lib/api/timeline", () => ({
    timelineApi: {
        delete: jest.fn(),
    },
}));

// Mock useChildren hook to avoid act() warnings from useEffect
mock.module("@/hooks/useChildren", () => ({
    useChildren: () => ({
        getChildrenByIds: jest.fn().mockReturnValue([]),
        isLoading: false,
        error: null,
        children: [],
        getChildById: jest.fn(),
        refresh: jest.fn(),
    }),
}));

const renderWithi18n = (ui: React.ReactElement) => {
    return render(
        <I18nextProvider i18n={i18n}>
            {ui}
        </I18nextProvider>
    );
};

describe("AttachmentCard", () => {
    const mockItem = {
        id: "attachment-1",
        type: "ATTACHMENT" as const,
        date: "2026-01-27",
        fileName: "test.pdf",
        fileUrl: "http://example.com/test.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        createdAt: new Date().toISOString(),
        createdBy: "user-owner",
        auditTrail: [],
        isDeleted: false,
        childIds: [],
        encryption: "PLAINTEXT" as const,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockUser = {
        id: "user-owner",
        email: "owner@example.com",
        emailVerified: true,
        name: "Owner User",
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const otherUser = {
        id: "user-other",
        email: "other@example.com",
        emailVerified: true,
        name: "Other User",
        createdAt: new Date(),
        updatedAt: new Date()
    };

    it("renders delete button for the owner", () => {
        renderWithi18n(<AttachmentCard item={mockItem} user={mockUser} />);
        expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    });

    it("hides delete button for non-owners", () => {
        renderWithi18n(<AttachmentCard item={mockItem} user={otherUser} />);
        expect(screen.queryByTestId("delete-button")).not.toBeInTheDocument();
    });

    it("calls delete API when delete button is clicked by owner", async () => {
        const onDelete = jest.fn();

        renderWithi18n(<AttachmentCard item={mockItem} user={mockUser} onDelete={onDelete} />);

        const deleteBtn = screen.getByTestId("delete-button");
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText("Confirm");
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith("attachment-1", expect.objectContaining({
                signatureBase64: expect.any(String),
                timestamp: expect.any(String),
                keyId: expect.any(String),
            }));
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
