import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '../../../../design-system';

export interface AttentionListItem {
  key: string;
  icon: LucideIcon;
  /** Already-translated title. */
  label: string;
  /** Already-translated one-line "what to do about it" hint. */
  hint: string;
  count: number;
  /** Real target page for this exception, if one exists. Omitted (not fabricated) when no honest destination exists yet. */
  linkPath?: string;
}

/**
 * Generic "exception count" list row -- icon, title, hint, count, and
 * (where a real target page exists) a link straight to the filtered queue.
 * Shared by every dashboard's own requires-attention panel (Admin/MPS/...),
 * each building its own `items` from whatever real exception data it has,
 * rather than duplicating this row markup per dashboard.
 */
export function AttentionListPanel({ items, emptyTitle }: { items: AttentionListItem[]; emptyTitle: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <div
              className={
                item.count > 0
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-subtle text-danger-emphasis'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-secondary'
              }
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text-primary">{item.label}</div>
              <div className="text-xs text-text-secondary">{item.hint}</div>
            </div>
            <div className="text-xl font-bold text-text-primary">{item.count}</div>
          </>
        );

        return (
          <li key={item.key}>
            {item.linkPath ? (
              <Link
                to={item.linkPath}
                className="flex items-center gap-3 rounded-xl bg-surface-sunken/60 px-3 py-3 transition-colors hover:bg-danger-subtle/60"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-surface-sunken/60 px-3 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
