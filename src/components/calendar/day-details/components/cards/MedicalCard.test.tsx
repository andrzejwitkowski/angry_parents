import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicalCard } from './MedicalCard';
import type { MedicalVisitItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
vi.mock('@/lib/api/timeline', () => ({
    timelineApi: {
        delete: vi.fn(),
    },
}));

const mockItem: MedicalVisitItem = {
    id: 'medical-1',
    type: 'MEDICAL_VISIT',
    date: '2026-01-27',
    createdAt: new Date().toISOString(),
    createdBy: 'user-owner',
    doctor: 'Dr. House',
    diagnosis: 'Lupus (it is never lupus)',
    recommendations: 'Sarcasm and vicodin',
    attachments: [],
};

const ownerUser = { id: 'user-owner' };
const otherUser = { id: 'user-other' };

describe('MedicalCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(<MedicalCard item={mockItem} user={ownerUser} />);
        expect(screen.getByText('Dr. House')).toBeInTheDocument();
        expect(screen.getByText('Lupus (it is never lupus)')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument(); // Trash button
    });

    it('renders correctly for non-owner', () => {
        render(<MedicalCard item={mockItem} user={otherUser} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onUpdate = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);

        render(<MedicalCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />);

        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('medical-1');
            expect(onUpdate).toHaveBeenCalled();
        });
    });
});
