import { render, screen, waitFor } from '@testing-library/react';
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
    beforeAll(() => {
        // Setup i18n
        i18n.init();
    });

    it('renders child names instead of IDs in audit log', async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <TimelineHistoryDialog item={mockItem} trigger={<button>Open History</button>} />
            </I18nextProvider>
        );

        // Click to open dialog
        const trigger = screen.getByText('Open History');
        trigger.click();

        // Wait for dialog to open and content to render
        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        // Check if "Alice" is displayed for the update (childIds: ['child-1'])
        // We might want to be more specific, but for now just checking presence is a good start.
        // The previous implementation would show "child-1" or json array.
        // We strictly want names to appear.
        expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);

        // Ensure IDs are NOT displayed (unless they happen to be names, which they aren't here)
        expect(screen.queryByText('child-1')).not.toBeInTheDocument();
        expect(screen.queryByText(/child-1/)).not.toBeInTheDocument();

        // Check for "No children assigned" text
        // It might appear multiple times if the audit log has multiple entries with empty children, 
        // or if the text is broken up. Using getAllByText is safer here.
        expect(screen.getAllByText('No children assigned').length).toBeGreaterThan(0);
    });
});
