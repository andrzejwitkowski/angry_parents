import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
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

const ownerUser = {
    id: 'user-owner',
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const otherUser = {
    id: 'user-other',
    name: "Other User",
    email: "other@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('MedsCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} />
            </I18nextProvider>
        );
        expect(screen.getByText('Paracetamol')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).not.toBeDisabled();
        expect(screen.getByRole('button')).toBeInTheDocument(); // Trash button
    });

    it('renders correctly for non-owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={otherUser} />
            </I18nextProvider>
        );
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onUpdate when checkbox is toggled by owner', async () => {
        const onUpdate = vi.fn();
        (timelineApi.update as any).mockResolvedValue({ ...mockItem, administered: true });

        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />
            </I18nextProvider>
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        await vi.waitFor(() => {
            expect(timelineApi.update).toHaveBeenCalledWith('1', { administered: true });
            expect(onUpdate).toHaveBeenCalled();
        });
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onUpdate = vi.fn();
        const onDelete = vi.fn();

        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} onDelete={onDelete} />
            </I18nextProvider>
        );

        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText('Confirm');
        fireEvent.click(confirmBtn);

        await vi.waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('1');
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
