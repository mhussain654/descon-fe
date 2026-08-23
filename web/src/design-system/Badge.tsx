import classNames from 'classnames';
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-secondary',
  brand: 'bg-brand-subtle text-brand-emphasis',
  success: 'bg-success-subtle text-success-emphasis',
  warning: 'bg-warning-subtle text-warning-emphasis',
  danger: 'bg-danger-subtle text-danger-emphasis',
  info: 'bg-info-subtle text-info-emphasis',
};

const DEFAULT_ICONS: Record<BadgeTone, typeof Circle> = {
  neutral: Circle,
  brand: Circle,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Override the tone's default icon, or pass `null` to hide it. Status is never conveyed by color alone, so an icon always ships unless explicitly hidden. */
  icon?: ReactNode | null;
}

/** Status badge. Pairs color with an icon so meaning survives color blindness/grayscale printing. */
export function Badge({ tone = 'neutral', children, icon }: BadgeProps) {
  const DefaultIcon = DEFAULT_ICONS[tone];
  const resolvedIcon = icon === null ? null : (icon ?? <DefaultIcon className="h-3.5 w-3.5" aria-hidden="true" />);

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[tone]
      )}
    >
      {resolvedIcon}
      {children}
    </span>
  );
}
