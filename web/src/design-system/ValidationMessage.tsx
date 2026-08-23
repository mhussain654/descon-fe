import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { HTMLAttributes } from 'react';

export type ValidationTone = 'error' | 'success';

export interface ValidationMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: ValidationTone;
  id?: string;
}

const TONE_CLASSES: Record<ValidationTone, string> = {
  error: 'text-danger',
  success: 'text-success',
};

/**
 * Field-level validation feedback. Pairs an icon with the text so meaning
 * doesn't rely on color alone, and uses `role="alert"` so screen readers
 * announce it as it appears (AGENTS.md: "Announce validation errors...").
 */
export function ValidationMessage({ tone = 'error', children, ...props }: ValidationMessageProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <p
      {...props}
      role="alert"
      className={`mt-1.5 flex items-start gap-1.5 text-sm ${TONE_CLASSES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
