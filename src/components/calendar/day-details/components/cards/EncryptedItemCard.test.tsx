import { render, screen } from '@testing-library/react';
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { describe, it, expect, beforeEach } from 'bun:test';
import { EncryptedItemCard } from './EncryptedItemCard';
import type { EncryptedTimelineItem } from '@/types/timeline.types';

const mockItem: EncryptedTimelineItem = {
    id: 'enc-1',
    type: 'NOTE',
    date: '2026-03-05',
    createdAt: '2026-03-05T12:00:00.000Z',
    createdBy: 'user-1',
    createdByName: 'Test User',
    auditTrail: [
        { timestamp: '2026-03-05T11:00:00.000Z', userId: 'user-1', userName: 'Test User', action: 'CREATED' },
        { timestamp: '2026-03-05T12:00:00.000Z', userId: 'user-2', userName: 'Other User', action: 'UPDATED' }
    ],
    isDeleted: false,
    childIds: ['child-1'],
    encryption: 'ENCRYPTED',
    ciphertext: 'some-encrypted-string'
};

describe('EncryptedItemCard', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('renders lock icon and encryption messages', () => {
        localStorage.setItem("zk_private_key", "dummy-key");
        render(
            <I18nextProvider i18n={i18n}>
                <EncryptedItemCard item={mockItem} />
            </I18nextProvider>
        );

        // Check for "Encrypted Entry" title (daylog.encryptedEntry)
        expect(screen.getByText('Encrypted Entry')).toBeInTheDocument();

        // Check for "Decryption failed (check your keys)." (common.decryptionFailed)
        // Note: We just updated this to sentence style in en.json
        expect(screen.getByText('Decryption failed (check your keys).')).toBeInTheDocument();

        // Check for notice message (daylog.encryptedContentNotice)
        expect(screen.getByText(/This entry is encrypted and could not be decrypted/)).toBeInTheDocument();

        // Find by timestamp date string
        expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('renders AuditIndicator', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <EncryptedItemCard item={mockItem} />
            </I18nextProvider>
        );

        // AuditIndicator is rendered in the card footer
        expect(screen.getByTestId('audit-indicator')).toBeInTheDocument();
    });
});
