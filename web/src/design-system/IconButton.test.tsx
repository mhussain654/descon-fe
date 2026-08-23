import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes the required label as its accessible name', () => {
    render(<IconButton icon={<svg />} label="Close" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('uses an already-translated Urdu label as the accessible name', () => {
    render(<IconButton icon={<svg />} label="بند کریں" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'بند کریں' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<svg />} label="Retry" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables itself and blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<svg />} label="Retry" onClick={onClick} loading />);
    const button = screen.getByRole('button', { name: 'Retry' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('respects an explicit disabled prop', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<svg />} label="Retry" onClick={onClick} disabled />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  });
});
