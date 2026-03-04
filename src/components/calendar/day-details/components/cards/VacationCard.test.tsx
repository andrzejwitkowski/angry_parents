import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, jest, mock, beforeEach } from "bun:test";
import { VacationCard } from "./VacationCard";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { timelineApi } from "@/lib/api/timeline";

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

describe("VacationCard", () => {
    const mockItem = {
        id: "vacation-1",
        type: "VACATION" as const,
        date: "2026-01-27",
        status: "APPROVED" as const,
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
        renderWithi18n(<VacationCard item={mockItem} user={user} />);
        expect(screen.getByTestId("delete-button")).toBeInTheDocument();
        expect(screen.getByTestId("edit-button")).toBeInTheDocument();
    });

    it("hides delete button for non-owners", () => {
        const user = createMockUser("user-other");
        renderWithi18n(<VacationCard item={mockItem} user={user} />);
        expect(screen.queryByTestId("delete-button")).not.toBeInTheDocument();
        expect(screen.queryByTestId("edit-button")).not.toBeInTheDocument();
    });

    it("calls delete API when delete button is clicked by owner", async () => {
        const onDelete = jest.fn();
        const user = createMockUser("user-owner");

        renderWithi18n(<VacationCard item={mockItem} user={user} onDelete={onDelete} />);

        const deleteBtn = screen.getByTestId("delete-button");
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText("Confirm");
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith("vacation-1", expect.objectContaining({
                signatureBase64: expect.any(String),
                timestamp: expect.any(String),
                keyId: expect.any(String),
            }));
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
