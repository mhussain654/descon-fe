import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('associates the label with the field via htmlFor/id', () => {
    render(<Textarea label="Reason" />);
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });

  it('shows helper text and links it via aria-describedby when there is no error', () => {
    render(<Textarea label="Reason" helperText="Explain what's wrong" />);
    const textarea = screen.getByLabelText('Reason');
    const describedBy = textarea.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Explain what's wrong");
    expect(textarea).not.toHaveAttribute('aria-invalid');
  });

  it('switches to the validation message and marks the field invalid when there is an error', () => {
    render(<Textarea label="Reason" helperText="Explain" errorMessage="A reason is required" />);
    const textarea = screen.getByLabelText('Reason');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('A reason is required');
    expect(screen.queryByText('Explain')).not.toBeInTheDocument();
  });

  it('renders an already-translated Urdu label and error without clipping them', () => {
    render(<Textarea label="وجہ" errorMessage="ایک درست وجہ درج کریں (10 سے 500 حروف، بغیر HTML کے)۔" />);
    expect(screen.getByLabelText('وجہ')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert.className).not.toMatch(/truncate|overflow-hidden/);
  });

  it('disables the field when disabled is set', () => {
    render(<Textarea label="Reason" disabled />);
    expect(screen.getByLabelText('Reason')).toBeDisabled();
  });

  it('preserves typed content (value is controlled by the caller, not reset internally)', () => {
    render(<Textarea label="Reason" value="Document is unreadable." onChange={() => {}} />);
    expect(screen.getByLabelText('Reason')).toHaveValue('Document is unreadable.');
  });
});
