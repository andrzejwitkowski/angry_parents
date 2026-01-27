import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedsCard } from './MedsCard';
import type { MedsItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
vi.mock('@/lib/api/timeline', () => ({
    timelineApi: {
        update: vi.fn(),
    },
}));

const mockItem: MedsItem = {
    id: '1',
    type: 'MEDS',
    date: '2026-01-27',
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
    medicineName: 'Paracetamol',
    dosage: '500mg',
    administered: false,
};

describe('MedsCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<MedsCard item={mockItem} />);
        expect(screen.getByText('Paracetamol')).toBeInTheDocument();
        expect(screen.getByText('500mg')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('calls onUpdate when checkbox is toggled', async () => {
        const onUpdate = vi.fn();
        (timelineApi.update as any).mockResolvedValue({ ...mockItem, administered: true });

        render(<MedsCard item={mockItem} onUpdate={onUpdate} />);

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        await vi.waitFor(() => {
            expect(timelineApi.update).toHaveBeenCalledWith('1', { administered: true });
            expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
                administered: true
            }));
        });
    });
});
