import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustodyPreviewModal } from "./CustodyPreviewModal";
import type { CustodyEntry, CustodyPatternConfig, PatternType } from "@/types/custody";

import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";


// Mock ResizeObserver for shadcn/ui ScrollArea
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}
global.ResizeObserver = ResizeObserverMock;

// Mock PointerEvent
class MockPointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    pointerType: string;

    constructor(type: string, props: PointerEventInit) {
        super(type, props);
        this.button = props.button || 0;
        this.ctrlKey = props.ctrlKey || false;
        this.pointerType = props.pointerType || 'mouse';
    }
}
window.PointerEvent = MockPointerEvent as any;
window.HTMLElement.prototype.scrollIntoView = mock();
window.HTMLElement.prototype.releasePointerCapture = mock();
window.HTMLElement.prototype.hasPointerCapture = mock();


describe("CustodyPreviewModal", () => {
    const mockOnClose = mock();
    const mockOnConfirm = mock();

    const baseConfig: Partial<CustodyPatternConfig> = {
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        type: "ALTERNATING_WEEKEND" as PatternType,
        startingParent: "DAD"
    };

    const baseEntries: CustodyEntry[] = [
        {
            id: "1",
            childId: "child1",
            date: "2026-05-01",
            startTime: "17:00",
            endTime: "19:00",
            assignedTo: "DAD",
            isRecurring: true,
            priority: 1
        }
    ];

    beforeEach(() => {
        mockOnClose.mockClear();
        mockOnConfirm.mockClear();
    });

    it("renders successfully when open and displays calendar", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        // Should see the title
        expect(screen.getByText("Schedule Preview")).toBeInTheDocument();
        // Should see "Confirm Save" button
        expect(screen.getByText("Confirm & Save")).toBeInTheDocument();
        // Should see "Detected Blocks" summary
        expect(screen.getByText("Detected Blocks")).toBeInTheDocument();
    });

    it("generates correct explanation for ALTERNATING_WEEKEND", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        // Verification of the text structure
        expect(screen.getByText(/Alternating Weekend starting with Dad from 2026-05-01 to 2026-05-31/)).toBeInTheDocument();
    });

    it("generates correct explanation for CUSTOM_BLOCK", () => {
        const config: Partial<CustodyPatternConfig> = {
            startDate: "2026-05-01",
            type: "CUSTOM_BLOCK" as PatternType,
            startingParent: "MOM",
            customBlockEndDayOffset: 3,
            customBlockRepeatInterval: 2,
            customBlockRepeatUnit: 'WEEKS'
        };

        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={config}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        expect(screen.getByText(/Custom block of 3 days assigned to Mom/)).toBeInTheDocument();
    });

    it("generates correct explanation for CUSTOM_SEQUENCE", () => {
        const config: Partial<CustodyPatternConfig> = {
            startDate: "2026-05-01",
            type: "CUSTOM_SEQUENCE" as PatternType,
            sequence: [2, 2, 3]
        };

        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={config}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        expect(screen.getByText(/Custom sequence: 2, 2, 3/)).toBeInTheDocument();
    });

    it("disables confirm button when isLoading is true", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={true}
                />
            </I18nextProvider>
        );

        const confirmBtn = screen.getByText("Saving...");
        expect(confirmBtn).toBeDisabled();
    });

    it("disables confirm button when entries are empty", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={[]}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        const confirmBtn = screen.getByText("Confirm & Save");
        expect(confirmBtn).toBeDisabled();
    });

    it("calls onConfirm when confirm button is clicked", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        const confirmBtn = screen.getByText("Confirm & Save");
        fireEvent.click(confirmBtn);
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when cancel button is clicked", () => {
        render(
            <I18nextProvider i18n={i18n}>
                <CustodyPreviewModal
                    isOpen={true}
                    onClose={mockOnClose}
                    entries={baseEntries}
                    config={baseConfig}
                    selectedChild={null}
                    onConfirm={mockOnConfirm}
                    isLoading={false}
                />
            </I18nextProvider>
        );

        const cancelBtn = screen.getByText("Cancel");
        fireEvent.click(cancelBtn);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});
