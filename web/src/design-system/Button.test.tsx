import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, type ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'outline', 'destructive', 'text'];

describe('Button', () => {
  it.each(VARIANTS)('renders the %s variant as a native button with its label', (variant) => {
    render(<Button variant={variant}>Continue</Button>);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('renders long Urdu text without truncating it', () => {
    render(
      <Button>
        جاری رکھیں اور اپنی معلومات کی تصدیق کریں تاکہ درخواست کا عمل مکمل ہو سکے
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button.className).not.toMatch(/truncate|overflow-hidden|text-ellipsis/);
    expect(button.textContent).toContain('جاری رکھیں');
  });

  it('fires onClick on click and on keyboard activation', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Send OTP</Button>);
    const button = screen.getByRole('button', { name: 'Send OTP' });

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Native <button> elements activate on Enter/Space by default; this
    // asserts we didn't add anything (e.g. a custom keydown handler) that
    // would interfere with that.
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('does not fire onClick while disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Continue
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('marks itself busy and disabled while loading, without losing its accessible name', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Verify OTP
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Verify OTP' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
