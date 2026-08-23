import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes value via progressbar role and aria-value attributes', () => {
    render(<ProgressBar value={30} label="Mobilization progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Mobilization progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '30');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps out-of-range values to 0-100', () => {
    const { rerender } = render(<ProgressBar value={150} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(<ProgressBar value={-20} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders already-formatted display text', () => {
    render(<ProgressBar value={30} label="Progress" displayText="30% complete" />);
    expect(screen.getByText('30% complete')).toBeInTheDocument();
  });

  it('renders an already-translated Urdu label', () => {
    render(<ProgressBar value={30} label="متحرک کاری کی پیشرفت" />);
    expect(screen.getByRole('progressbar', { name: 'متحرک کاری کی پیشرفت' })).toBeInTheDocument();
  });
});
