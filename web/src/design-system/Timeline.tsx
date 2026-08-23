import classNames from 'classnames';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

export type TimelineItemStatus = 'completed' | 'current' | 'pending';

export interface TimelineItemData {
  id: string | number;
  /** Already-translated step label. */
  label: string;
  /** Already-formatted secondary text, e.g. a localized date. */
  description?: string;
  status: TimelineItemStatus;
  /** Already-translated status word (e.g. `t('inProgress')`), read by screen readers alongside the marker icon. */
  statusText?: string;
  /** e.g. a Badge showing "In progress". */
  trailing?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItemData[];
}

const MARKER_CLASSES: Record<TimelineItemStatus, string> = {
  completed: 'bg-success-subtle text-success-emphasis',
  current: 'bg-brand-subtle text-brand-emphasis ring-2 ring-brand',
  pending: 'bg-background text-text-tertiary ring-2 ring-border',
};

/** Vertical status timeline, e.g. mobilization progress. Status is shown by icon + text, not color alone. */
export function Timeline({ items }: TimelineProps) {
  return (
    <ol>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={classNames(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                MARKER_CLASSES[item.status]
              )}
              aria-hidden="true"
            >
              {item.status === 'completed' ? <Check className="h-4 w-4" /> : null}
              {item.status === 'current' ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
            </div>
            {index < items.length - 1 ? (
              <div
                className={classNames(
                  'min-h-12 w-0.5 flex-1',
                  item.status === 'completed' ? 'bg-success' : 'bg-border'
                )}
              />
            ) : null}
          </div>
          <div className="pb-6">
            <div
              className={classNames(
                'text-base text-text-primary',
                item.status === 'current' ? 'font-semibold' : 'font-medium'
              )}
            >
              {item.label}
              {item.statusText ? <span className="sr-only"> ({item.statusText})</span> : null}
            </div>
            {item.description ? <div className="mt-1 text-sm text-text-secondary">{item.description}</div> : null}
            {item.trailing ? <div className="mt-3">{item.trailing}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
