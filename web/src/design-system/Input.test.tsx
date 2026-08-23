import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the field via htmlFor/id', () => {
    render(<Input label="CNIC Number" />);
    const input = screen.getByLabelText('CNIC Number');
    expect(input).toBeInTheDocument();
  });

  it('shows helper text and links it via aria-describedby when there is no error', () => {
    render(<Input label="CNIC Number" helperText="Digits only, no dashes" />);
    const input = screen.getByLabelText('CNIC Number');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Digits only, no dashes');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('switches to the validation message and marks the field invalid when there is an error', () => {
    render(<Input label="CNIC Number" helperText="Digits only" errorMessage="CNIC is required" />);
    const input = screen.getByLabelText('CNIC Number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('CNIC is required');
    expect(screen.queryByText('Digits only')).not.toBeInTheDocument();
  });

  it('renders an already-translated Urdu label and error without clipping them', () => {
    render(
      <Input
        label="شناختی کارڈ نمبر"
        errorMessage="یہ خانہ درکار ہے اور اسے مکمل طور پر پر کیا جانا چاہیے۔"
      />
    );
    expect(screen.getByLabelText('شناختی کارڈ نمبر')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert.className).not.toMatch(/truncate|overflow-hidden/);
    expect(alert.textContent).toContain('یہ خانہ درکار ہے');
  });

  it('disables the field when disabled is set', () => {
    render(<Input label="CNIC Number" disabled />);
    expect(screen.getByLabelText('CNIC Number')).toBeDisabled();
  });
});
