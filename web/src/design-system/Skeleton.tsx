import classNames from 'classnames';
import type { HTMLAttributes } from 'react';

/** Placeholder shape shown while content is loading. Match its size to the final layout so nothing jumps once real content arrives. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={classNames('animate-pulse rounded-lg bg-surface-sunken', className)}
    />
  );
}
