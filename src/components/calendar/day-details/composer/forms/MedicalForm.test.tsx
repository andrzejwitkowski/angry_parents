import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest } from 'bun:test';
import { MedicalForm } from './MedicalForm';

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
