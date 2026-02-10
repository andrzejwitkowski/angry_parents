import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, jest, mock, beforeEach } from "bun:test";
import { HandoverCard } from "./HandoverCard";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { timelineApi } from "@/lib/api/timeline";

// Mock the API
mock.module("@/lib/api/timeline", () => ({
    timelineApi: {
        delete: jest.fn(),
    },
}));

const renderWithi18n = (ui: React.ReactElement) => {
    return render(
        <I18nextProvider i18n={i18n}>
            {ui}
        </I18nextProvider>
    );
};

describe("HandoverCard", () => {
    const mockItem = {
        id: "handover-1",
        type: "HANDOVER" as const,
        date: "2026-01-27",
        status: "PENDING" as const,
        location: "Test Location",
        time: "10:00",
        createdAt: new Date().toISOString(),
        createdBy: "user-owner",
        auditTrail: [],
        isDeleted: false,
        childIds: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createMockUser = (id: string) => ({
        id,
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    it("renders delete button for the owner", () => {
        const user = createMockUser("user-owner");
        renderWithi18n(<HandoverCard item={mockItem} user={user} />);
        expect(screen.getByTestId("delete-button")).toBeInTheDocument();
        expect(screen.getByTestId("edit-button")).toBeInTheDocument();
    });

    it("hides delete button for non-owners", () => {
        const user = createMockUser("user-other");
        renderWithi18n(<HandoverCard item={mockItem} user={user} />);
        expect(screen.queryByTestId("delete-button")).not.toBeInTheDocument();
        expect(screen.queryByTestId("edit-button")).not.toBeInTheDocument();
    });

    it("calls delete API when delete button is clicked by owner", async () => {
        const onDelete = jest.fn();
        const user = createMockUser("user-owner");

        renderWithi18n(<HandoverCard item={mockItem} user={user} onDelete={onDelete} />);

        const deleteBtn = screen.getByTestId("delete-button");
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText("Confirm");
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith("handover-1");
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
