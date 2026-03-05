import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { describe, it, expect, jest, mock, beforeEach } from 'bun:test';
import { MedicalCard } from './MedicalCard';
import type { MedicalVisitItem } from '@/types/timeline.types';
import { timelineApi } from '@/lib/api/timeline';

// Mock the API
// Mock the API
// Mock the API
mock.module('@/lib/api/timeline', () => ({
    timelineApi: {
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
    auditTrail: [],
    isDeleted: false,
    childIds: [],
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

describe('MedicalCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly for owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedicalCard item={mockItem} user={ownerUser} />
            </I18nextProvider>
        );
        expect(screen.getByText('Dr. House')).toBeInTheDocument();
        expect(screen.getByText('Lupus (it is never lupus)')).toBeInTheDocument();
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('renders correctly for non-owner', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <MedicalCard item={mockItem} user={otherUser} />
            </I18nextProvider>
        );
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('calls delete API when delete button is clicked by owner', async () => {
        const onDelete = jest.fn();

        render(
            <I18nextProvider i18n={i18n}>
                <MedicalCard item={mockItem} user={ownerUser} onDelete={onDelete} />
            </I18nextProvider>
        );

        const deleteBtn = screen.getByTestId('delete-button');
        fireEvent.click(deleteBtn);

        // Find the confirm button in the AlertDialog
        const confirmBtn = await screen.findByText('Confirm');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(timelineApi.delete).toHaveBeenCalledWith('medical-1', expect.objectContaining({
                signatureBase64: expect.any(String),
                timestamp: expect.any(String),
                keyId: expect.any(String),
            }));
            expect(onDelete).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});
