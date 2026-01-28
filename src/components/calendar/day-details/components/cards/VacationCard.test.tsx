import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VacationCard } from "./VacationCard";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { timelineApi } from "@/lib/api/timeline";

// Mock the API
vi.mock("@/lib/api/timeline", () => ({
    timelineApi: {
        delete: vi.fn(),
    },
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
    };

    beforeEach(() => {
        vi.clearAllMocks();
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
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("hides delete button for non-owners", () => {
        const user = createMockUser("user-other");
        renderWithi18n(<VacationCard item={mockItem} user={user} />);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("calls delete API when delete button is clicked by owner", async () => {
        const onDelete = vi.fn();
        const user = createMockUser("user-owner");

        renderWithi18n(<VacationCard item={mockItem} user={user} onDelete={onDelete} />);

        const deleteBtn = screen.getByRole("button");
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText("Confirm");
        fireEvent.click(confirmBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith("vacation-1");
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
