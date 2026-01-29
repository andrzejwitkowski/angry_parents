import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DayCellBackground } from "./DayCellBackground";
import type { CustodyEntry } from "@/types/custody";

// Mock entries
const mockEntry = (id: string, assignedTo: 'MOM' | 'DAD', start: string, end: string): CustodyEntry => ({
    id,
    childId: 'c1',
    date: '2024-01-01',
    startTime: start,
    endTime: end,
    assignedTo,
    isRecurring: true,
    priority: 0
});

describe('DayCellBackground', () => {
    it('renders nothing if entries are empty', () => {
        const { container } = render(<DayCellBackground entries={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders solid background for single entry', () => {
        const entries = [mockEntry('1', 'MOM', '00:00', '23:59')];
        render(<DayCellBackground entries={entries} />);

        const el = screen.getByTestId('day-cell-background');
        // Check for specific color or style property
        // Note: Computed style might differ, let's check basic style attribute
        const style = window.getComputedStyle(el);
        // In JSDOM, background color might be set
        // Or check inline style
        expect(el.style.backgroundColor).toContain('rgba(236, 72, 153, 0.15)');
    });

    it('renders gradient for split day (50/50)', () => {
        const entries = [
            mockEntry('1', 'MOM', '00:00', '12:00'),
            mockEntry('2', 'DAD', '12:00', '23:59')
        ];
        render(<DayCellBackground entries={entries} />);
        const el = screen.getByTestId('day-cell-background');

        // 12:00 is 50%
        expect(el.style.background).toContain('linear-gradient(135deg');
        expect(el.style.background).toContain('50%');
    });
});
