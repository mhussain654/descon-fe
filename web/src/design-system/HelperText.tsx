import type { HTMLAttributes } from 'react';

export interface HelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
  id?: string;
}

/** Neutral guidance text under a field. Pass `id` and wire it to the field's `aria-describedby`. */
export function HelperText({ children, ...props }: HelperTextProps) {
  return (
    <p {...props} className="mt-1.5 text-sm text-text-secondary">
      {children}
    </p>
  );
}
