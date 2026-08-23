import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} previousLabel="Previous page" nextLabel="Next page" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Previous on the first page and Next on the last page', () => {
    render(
      <Pagination page={1} pageCount={3} onPageChange={() => {}} previousLabel="Previous page" nextLabel="Next page" />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('marks the current page with aria-current and calls onPageChange for others', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={2} pageCount={3} onPageChange={onPageChange} previousLabel="Previous page" nextLabel="Next page" />
    );
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('advances/retreats a page via Previous/Next', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={2} pageCount={5} onPageChange={onPageChange} previousLabel="Previous page" nextLabel="Next page" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('uses a caller-supplied formatter for locale-aware page numbers', () => {
    render(
      <Pagination
        page={1}
        pageCount={2}
        onPageChange={() => {}}
        previousLabel="Previous page"
        nextLabel="Next page"
        formatPageNumber={(n) => `#${n}`}
      />
    );
    expect(screen.getByRole('button', { name: '#1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#2' })).toBeInTheDocument();
  });

  it('flips the previous/next chevrons for RTL via the `rtl:` variant, not just their position', () => {
    render(
      <Pagination page={2} pageCount={3} onPageChange={() => {}} previousLabel="Previous page" nextLabel="Next page" />
    );
    const previousIcon = screen.getByRole('button', { name: 'Previous page' }).querySelector('svg');
    const nextIcon = screen.getByRole('button', { name: 'Next page' }).querySelector('svg');
    expect(previousIcon?.getAttribute('class')).toMatch(/rtl:rotate-180/);
    expect(nextIcon?.getAttribute('class')).toMatch(/rtl:rotate-180/);
  });

  it('collapses a long run of pages with an ellipsis', () => {
    render(
      <Pagination page={1} pageCount={20} onPageChange={() => {}} previousLabel="Previous page" nextLabel="Next page" />
    );
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
  });
});
