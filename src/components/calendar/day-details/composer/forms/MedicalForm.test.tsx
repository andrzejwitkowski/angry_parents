import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, mock } from 'bun:test';
import { MedicalForm } from './MedicalForm';

// Mock the API
mock.module("@/lib/api/timeline", () => ({
    timelineApi: {
        create: jest.fn().mockResolvedValue({ id: "new-id" }),
    },
}));

// Mock useChildren hook to avoid act() warnings from useEffect
mock.module("@/hooks/useChildren", () => ({
    useChildren: () => ({
        children: [
            { id: "child-1", name: "Child 1", color: "#FF0000" },
            { id: "child-2", name: "Child 2", color: "#00FF00" },
        ],
        isLoading: false,
        error: null,
        getChildrenByIds: (ids: string[]) => [
            { id: "child-1", name: "Child 1", color: "#FF0000" },
            { id: "child-2", name: "Child 2", color: "#00FF00" },
        ].filter(c => ids.includes(c.id)),
        getChildById: (id: string) => [
            { id: "child-1", name: "Child 1", color: "#FF0000" },
            { id: "child-2", name: "Child 2", color: "#00FF00" },
        ].find(c => c.id === id),
        refresh: jest.fn(),
    }),
}));

describe('MedicalForm', () => {
    it('renders correctly', () => {
        render(<MedicalForm onSubmit={jest.fn()} />);
        expect(screen.getByText('Medical Visit Details')).toBeInTheDocument();
        expect(screen.getByLabelText(/doctor name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/diagnosis/i)).toBeInTheDocument();
    });

    it('shows validation errors when fields are empty', async () => {
        render(<MedicalForm onSubmit={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /add medical visit/i }));

        expect(await screen.findByText(/doctor name is required/i)).toBeInTheDocument();
        expect(await screen.findByText(/diagnosis must be at least 3 characters/i)).toBeInTheDocument();
    });

    it('calls onSubmit with correct data when valid', async () => {
        const onSubmit = jest.fn();
        render(<MedicalForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText(/doctor name/i), { target: { value: 'Dr. Smith' } });
        fireEvent.change(screen.getByLabelText(/diagnosis/i), { target: { value: 'Common Cold' } });
        fireEvent.change(screen.getByLabelText(/recommendations/i), { target: { value: 'Rest and fluids' } });

        fireEvent.click(screen.getByRole('button', { name: /add medical visit/i }));

        // Wait for form submission (async)
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
        }, { timeout: 2000 });

        const submission = onSubmit.mock.calls[0][0];
        expect(submission.doctor).toBe('Dr. Smith');
        expect(submission.diagnosis).toBe('Common Cold');
        expect(submission.recommendations).toBe('Rest and fluids');
    });
});
