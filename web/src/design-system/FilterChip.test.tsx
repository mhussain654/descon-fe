import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  it('reflects selection via aria-pressed', () => {
    const { rerender } = render(
      <FilterChip selected={false} onClick={() => {}}>
        Documents Pending
      </FilterChip>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <FilterChip selected onClick={() => {}}>
        Documents Pending
      </FilterChip>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires onClick when pressed', () => {
    const onClick = vi.fn();
    render(
      <FilterChip selected={false} onClick={onClick}>
        All
      </FilterChip>
    );
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
