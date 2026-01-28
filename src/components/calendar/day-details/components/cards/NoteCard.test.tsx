import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
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
    createdBy: 'user-1',
    content: 'This is a test note',
};

const ownerUser = {
    id: "user-1",
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date()
};
const otherUser = {
    id: "user-2",
    email: "other@example.com",
    emailVerified: true,
    name: "Other User",
    createdAt: new Date(),
    updatedAt: new Date()
};

describe('NoteCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <NoteCard item={mockItem} user={ownerUser} />
            </I18nextProvider>
        );
        expect(screen.getByText('This is a test note')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument(); // Trash button
    });

    it('renders correctly for non-owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <NoteCard item={mockItem} user={otherUser} />
            </I18nextProvider>
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onDelete = vi.fn();

        render(
            <I18nextProvider i18n={i18n}>
                <NoteCard item={mockItem} user={ownerUser} onDelete={onDelete} />
            </I18nextProvider>
        );

        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText('Confirm');
        fireEvent.click(confirmBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('note-1');
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
