import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteCard } from './NoteCard';
import type { NoteItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
vi.mock('@/lib/api/timeline', () => ({
    timelineApi: {
        delete: vi.fn(),
    },
}));

const mockItem: NoteItem = {
    id: 'note-1',
    type: 'NOTE',
    date: '2026-01-27',
    createdAt: new Date().toISOString(),
    createdBy: 'user-owner',
    content: 'This is a test note',
};

const ownerUser = { id: 'user-owner' };
const otherUser = { id: 'user-other' };

describe('NoteCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(<NoteCard item={mockItem} user={ownerUser} />);
        expect(screen.getByText('This is a test note')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument(); // Trash button
    });

    it('renders correctly for non-owner', () => {
        render(<NoteCard item={mockItem} user={otherUser} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onUpdate = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);

        render(<NoteCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />);

        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('note-1');
            expect(onUpdate).toHaveBeenCalled();
        });
    });
});
