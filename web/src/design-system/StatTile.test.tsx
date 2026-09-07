import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders the value and an already-translated label', () => {
    render(<StatTile value={42} label="Verified" />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('applies the tile and label class overrides', () => {
    const { container } = render(<StatTile value={1} label="Pending" className="bg-red-100" labelClassName="text-red-500" />);

    expect(container.querySelector('.bg-red-100')).not.toBeNull();
    expect(container.querySelector('.text-red-500')).not.toBeNull();
  });
});
