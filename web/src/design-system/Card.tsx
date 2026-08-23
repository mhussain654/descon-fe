import classNames from 'classnames';
import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Removes the default padding, for callers that need edge-to-edge content (e.g. a table). */
  noPadding?: boolean;
}

/** Surface container matching the approved prototype's card pattern (rounded-2xl, bordered, white). */
export function Card({ noPadding = false, className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={classNames(
        'rounded-2xl border border-border bg-surface-raised',
        !noPadding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={classNames('mb-4', className)} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={classNames('text-lg font-semibold text-text-primary', className)} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={classNames('mt-1 text-sm text-text-secondary', className)} />;
}
