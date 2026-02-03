import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncidentCard } from "./IncidentCard";
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

describe("IncidentCard", () => {
    const mockItem = {
        id: "incident-1",
        type: "INCIDENT" as const,
        date: "2026-01-27",
        severity: "HIGH" as const,
        description: "Test incident description",
        createdAt: new Date().toISOString(),
        createdBy: "user-owner",
        auditTrail: [],
        isDeleted: false,
        childIds: [],
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
        renderWithi18n(<IncidentCard item={mockItem} user={user} />);
        expect(screen.getByTestId("delete-button")).toBeInTheDocument();
        expect(screen.getByTestId("edit-button")).toBeInTheDocument();
    });

    it("hides delete button for non-owners", () => {
        const user = createMockUser("user-other");
        renderWithi18n(<IncidentCard item={mockItem} user={user} />);
        expect(screen.queryByTestId("delete-button")).not.toBeInTheDocument();
        expect(screen.queryByTestId("edit-button")).not.toBeInTheDocument();
    });

    it("calls delete API when delete button is clicked by owner", async () => {
        const onDelete = vi.fn();
        const user = createMockUser("user-owner");

        renderWithi18n(<IncidentCard item={mockItem} user={user} onDelete={onDelete} />);

        const deleteBtn = screen.getByTestId("delete-button");
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText("Confirm");
        fireEvent.click(confirmBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith("incident-1");
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
