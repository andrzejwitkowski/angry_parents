import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedsCard } from './MedsCard';
import type { MedsItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
vi.mock('@/lib/api/timeline', () => ({
    timelineApi: {
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockItem: MedsItem = {
    id: '1',
    type: 'MEDS',
    date: '2026-01-27',
    createdAt: new Date().toISOString(),
    createdBy: 'user-owner',
    medicineName: 'Paracetamol',
    dosage: '500mg',
    administered: false,
};

const ownerUser = { id: 'user-owner' };
const otherUser = { id: 'user-other' };

describe('MedsCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(<MedsCard item={mockItem} user={ownerUser} />);
        expect(screen.getByText('Paracetamol')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).not.toBeDisabled();
        expect(screen.getByRole('button')).toBeInTheDocument(); // Trash button
    });

    it('renders correctly for non-owner', () => {
        render(<MedsCard item={mockItem} user={otherUser} />);
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onUpdate when checkbox is toggled by owner', async () => {
        const onUpdate = vi.fn();
        (timelineApi.update as any).mockResolvedValue({ ...mockItem, administered: true });

        render(<MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />);

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        await vi.waitFor(() => {
            expect(timelineApi.update).toHaveBeenCalledWith('1', { administered: true });
            expect(onUpdate).toHaveBeenCalled();
        });
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onUpdate = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);

        render(<MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />);

        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('1');
            expect(onUpdate).toHaveBeenCalled();
        });
    });
});
