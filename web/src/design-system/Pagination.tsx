import { ChevronLeft, ChevronRight } from 'lucide-react';
import classNames from 'classnames';
import { IconButton } from './IconButton';

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Already-translated accessible name, e.g. `t('dsPreviousPage')`. */
  previousLabel: string;
  /** Already-translated accessible name, e.g. `t('dsNextPage')`. */
  nextLabel: string;
  /** Formats a page number for display (wire this to `formatNumber` for locale-aware digits). Defaults to plain `String(n)`. */
  formatPageNumber?: (page: number) => string;
  /** Already-translated label for the `<nav>` landmark, e.g. "Pagination". Optional. */
  navigationLabel?: string;
}

const ELLIPSIS = 'ellipsis' as const;

function buildPageList(page: number, pageCount: number): (number | typeof ELLIPSIS)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | typeof ELLIPSIS)[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) {
      result.push(ELLIPSIS);
    }
    result.push(p);
  });
  return result;
}

/** Page-based navigation for web tables/lists. See the mobile design system's List "load more" pattern for the mobile equivalent. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  previousLabel,
  nextLabel,
  formatPageNumber = String,
  navigationLabel,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={navigationLabel} className="flex items-center justify-center gap-1">
      <IconButton
        icon={<ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
        label={previousLabel}
        size="sm"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      {buildPageList(page, pageCount).map((entry, index) =>
        entry === ELLIPSIS ? (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-text-tertiary">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            aria-current={entry === page ? 'page' : undefined}
            onClick={() => onPageChange(entry)}
            className={classNames(
              'h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              entry === page ? 'bg-brand text-brand-on' : 'text-text-secondary hover:bg-surface-sunken'
            )}
          >
            {formatPageNumber(entry)}
          </button>
        )
      )}
      <IconButton
        icon={<ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
        label={nextLabel}
        size="sm"
        variant="ghost"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
