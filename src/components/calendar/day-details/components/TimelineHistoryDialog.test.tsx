import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { TimelineHistoryDialog } from './TimelineHistoryDialog';
import type { TimelineItem } from '@/types/timeline.types';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

// Mock useChildren hook
const mockChildren = [
    { id: 'child-1', name: 'Alice', icon: 'baby', color: 'pink' },
    { id: 'child-2', name: 'Bob', icon: 'baby', color: 'blue' },
];

mock.module('@/hooks/useChildren', () => ({
    useChildren: () => ({
        children: mockChildren,
        getChildrenByIds: (ids: string[]) => mockChildren.filter(c => ids.includes(c.id)),
        isLoading: false,
    }),
}));

// Mock API to avoid real calls if any (though we are mocking the hook)
mock.module('@/lib/api/children', () => ({
    childApi: {
        getAll: async () => mockChildren,
    },
}));

const mockItem: TimelineItem = {
    id: 'item-1',
    date: '2023-10-27',
    type: 'NOTE',
    content: 'Test Note',
    createdAt: '2023-10-27T10:00:00Z',
    createdBy: 'user-1',
    isDeleted: false,
    childIds: ['child-1', 'child-2'],
    auditTrail: [
        {
            timestamp: '2023-10-27T10:05:00Z',
            userId: 'user-1',
            action: 'UPDATED',
            changes: {
                childIds: ['child-1'], // Changed to just Alice
                content: 'Updated content'
            }
        },
        {
            timestamp: '2023-10-27T10:00:00Z',
            userId: 'user-1',
            action: 'CREATED',
            changes: {
                childIds: ['child-1', 'child-2']
            }
        },
        {
            timestamp: '2023-10-27T10:07:00Z',
            userId: 'user-1',
            action: 'UPDATED',
            changes: {
                childIds: [] // No children assigned
            }
        },
        {
            timestamp: '2023-10-27T10:07:00Z',
            userId: 'user-1',
            action: 'UPDATED',
            changes: {
                childIds: [] // No children assigned
            }
        }
    ]
};

describe('TimelineHistoryDialog', () => {
    it('renders child names instead of IDs in audit log', async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <TimelineHistoryDialog item={mockItem} trigger={<button>Open History</button>} />
            </I18nextProvider>
        );

        // Click to open dialog
        const trigger = screen.getByText('Open History');

        // Wrap in act to fix Dialog state update warning
        fireEvent.click(trigger);

        // Wait for dialog to open and content to render
        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument();
        }, { timeout: 2000 });

        // Check if "Alice" is displayed for the update (childIds: ['child-1'])
        expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);

        // Ensure IDs are NOT displayed
        expect(screen.queryByText('child-1')).not.toBeInTheDocument();
        expect(screen.queryByText(/child-1/)).not.toBeInTheDocument();

        // Check for "No children assigned" text
        expect(screen.getAllByText('No children assigned').length).toBeGreaterThan(0);
    });

    it('renders an accessible dialog description', async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <TimelineHistoryDialog item={mockItem} trigger={<button>Open History</button>} />
            </I18nextProvider>
        );

        fireEvent.click(screen.getByText('Open History'));

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const describedBy = dialog.getAttribute('aria-describedby');

            expect(describedBy).toBeTruthy();
            const description = document.getElementById(describedBy!);

            expect(description).toBeTruthy();
            expect(description).toHaveTextContent('Shows the full audit trail for this timeline item.');
            expect(description).toHaveClass('sr-only');
        }, { timeout: 2000 });
    });
});
