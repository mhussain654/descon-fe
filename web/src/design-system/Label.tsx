import type { LabelHTMLAttributes } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Already-translated "Required"/"Optional" marker text, or omit to show neither. */
  requirementText?: string;
}

/** Field label. Pass `htmlFor` matching the field's `id` so clicking the label focuses the field. */
export function Label({ children, requirementText, ...props }: LabelProps) {
  return (
    <label {...props} className="mb-1.5 block text-sm font-medium text-text-primary">
      {children}
      {requirementText ? (
        <span className="ms-1 font-normal text-text-tertiary">({requirementText})</span>
      ) : null}
    </label>
  );
}
