import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('exposes an accessible name and reports typed input', () => {
    const onValueChange = vi.fn();
    render(<SearchField value="" onValueChange={onValueChange} label="Search candidates" clearLabel="Clear" />);
    const input = screen.getByRole('searchbox', { name: 'Search candidates' });
    fireEvent.change(input, { target: { value: 'Ahmed' } });
    expect(onValueChange).toHaveBeenCalledWith('Ahmed');
  });

  it('only shows the clear button once there is a query, and clears it on click', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SearchField value="" onValueChange={onValueChange} label="Search" clearLabel="Clear search" />
    );
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    rerender(<SearchField value="Ahmed" onValueChange={onValueChange} label="Search" clearLabel="Clear search" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('renders an already-translated Urdu placeholder/label', () => {
    render(
      <SearchField
        value=""
        onValueChange={() => {}}
        label="تلاش کریں"
        clearLabel="صاف کریں"
        placeholder="نام، شناختی کارڈ، یا رجسٹریشن نمبر سے تلاش کریں..."
      />
    );
    expect(screen.getByRole('searchbox', { name: 'تلاش کریں' })).toBeInTheDocument();
  });
});
