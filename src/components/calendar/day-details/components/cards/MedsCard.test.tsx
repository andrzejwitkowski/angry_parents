import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { describe, it, expect, jest, mock, beforeEach } from 'bun:test';
import { MedsCard } from './MedsCard';
import type { MedsItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
mock.module('@/lib/api/timeline', () => ({
    timelineApi: {
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock useChildren hook to avoid act() warnings from useEffect
mock.module("@/hooks/useChildren", () => ({
    useChildren: () => ({
        getChildrenByIds: jest.fn().mockReturnValue([]),
        isLoading: false,
        error: null,
        children: [],
        getChildById: jest.fn(),
        refresh: jest.fn(),
    }),
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
    auditTrail: [],
    isDeleted: false,
    childIds: ["child-1"],
    encryption: 'PLAINTEXT',
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
        jest.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} />
            </I18nextProvider>
        );
        expect(screen.getByText('Paracetamol')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).not.toBeDisabled();
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('renders correctly for non-owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={otherUser} />
            </I18nextProvider>
        );
        expect(screen.getByRole('checkbox')).not.toBeDisabled();
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('calls onUpdate when checkbox is toggled by owner', async () => {
        const onUpdate = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (timelineApi.update as import("bun:test").Mock<any>).mockResolvedValue({ ...mockItem, administered: true });

        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} />
            </I18nextProvider>
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        await waitFor(() => {
            expect(timelineApi.update).toHaveBeenCalledWith(
                '1',
                expect.objectContaining({ administered: true }),
                expect.objectContaining({
                    signatureBase64: expect.any(String),
                    timestamp: expect.any(String),
                    keyId: expect.any(String),
                }),
                "child-1"
            );
            expect(onUpdate).toHaveBeenCalled();
        });
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onUpdate = jest.fn();
        const onDelete = jest.fn();

        render(
            <I18nextProvider i18n={i18n}>
                <MedsCard item={mockItem} user={ownerUser} onUpdate={onUpdate} onDelete={onDelete} />
            </I18nextProvider>
        );

        const deleteBtn = screen.getByTestId('delete-button');
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText('Confirm');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('1', expect.objectContaining({
                signatureBase64: expect.any(String),
                timestamp: expect.any(String),
                keyId: expect.any(String),
            }));
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
