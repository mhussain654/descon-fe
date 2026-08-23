import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OtpField } from './OtpField';

describe('OtpField', () => {
  it('exposes the already-translated label as the accessible name and forces left-to-right', () => {
    render(<OtpField label="One-Time Password" value="" onValueChange={() => {}} />);
    const input = screen.getByLabelText('One-Time Password');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  it('renders one visual box per digit of the configured length', () => {
    const { container } = render(<OtpField label="OTP" value="12" length={6} onValueChange={() => {}} />);
    // input-otp renders the slot boxes as direct children of its container,
    // plus one extra wrapper div holding the single real (visually hidden) input.
    const otpContainer = container.querySelector('[data-input-otp-container="true"]');
    expect(otpContainer?.children.length).toBe(7);
  });

  it('reports the typed value back through onValueChange', () => {
    const onValueChange = vi.fn();
    render(<OtpField label="OTP" value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('OTP'), { target: { value: '123456' } });
    expect(onValueChange).toHaveBeenCalledWith('123456');
  });

  it('shows a validation message when there is an error', () => {
    render(<OtpField label="OTP" value="" onValueChange={() => {}} errorMessage="Incorrect code" />);
    expect(screen.getByLabelText('OTP')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code');
  });

  it('renders an already-translated Urdu label', () => {
    render(<OtpField label="ایک بار کا پاس ورڈ" value="" onValueChange={() => {}} />);
    expect(screen.getByLabelText('ایک بار کا پاس ورڈ')).toBeInTheDocument();
  });
});
