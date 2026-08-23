import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CnicField } from './CnicField';

// formatCnic/toCnicDigits themselves are tested once, platform-independently,
// in ../../../shared/cnic.test.ts.
describe('CnicField', () => {
  it('displays the raw value formatted, and forces left-to-right reading order', () => {
    render(<CnicField label="CNIC Number" value="1234512345671" onValueChange={() => {}} />);
    const input = screen.getByLabelText('CNIC Number') as HTMLInputElement;
    expect(input.value).toBe('12345-1234567-1');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  it('reports only digits back through onValueChange, stripping non-numeric input', () => {
    const onValueChange = vi.fn();
    render(<CnicField label="CNIC Number" value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '12a345' } });
    expect(onValueChange).toHaveBeenCalledWith('12345');
  });

  it('shows a validation message and marks the field invalid on error', () => {
    render(
      <CnicField label="CNIC Number" value="" onValueChange={() => {}} errorMessage="CNIC is required" />
    );
    expect(screen.getByLabelText('CNIC Number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('CNIC is required');
  });

  it('stays left-to-right even when rendered inside an Urdu/RTL layout', () => {
    render(
      <div dir="rtl">
        <CnicField label="شناختی کارڈ نمبر" value="1234512345671" onValueChange={() => {}} />
      </div>
    );
    expect(screen.getByLabelText('شناختی کارڈ نمبر')).toHaveAttribute('dir', 'ltr');
  });
});
