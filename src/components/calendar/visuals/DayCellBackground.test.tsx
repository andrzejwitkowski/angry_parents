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
        // The background is applied to a descendant div inset-0 within SingleChildBackground
        const bgLayer = el.querySelector('.inset-0\\, \\.absolute')?.previousElementSibling || el.querySelector('div > div.absolute.inset-0');
        expect(bgLayer || el.querySelector('div > div > div.absolute.inset-0')).not.toBeNull();

        // Let's actually just get the inner div by its parent structure
        const bgNode = el.querySelector('div > div.absolute.inset-0') as HTMLElement;
        expect(bgNode.style.backgroundColor).toContain('rgba(236, 72, 153, 0.15)');
    });

    it('renders gradient for split day (50/50)', () => {
        const entries = [
            mockEntry('1', 'MOM', '00:00', '12:00'),
            mockEntry('2', 'DAD', '12:00', '23:59')
        ];
        render(<DayCellBackground entries={entries} />);
        const el = screen.getByTestId('day-cell-background');

        const bgNode = el.querySelector('div > div.absolute.inset-0') as HTMLElement;
        // 12:00 is 50%
        expect(bgNode.style.background).toContain('linear-gradient(135deg');
        expect(bgNode.style.background).toContain('50%');
    });
});
