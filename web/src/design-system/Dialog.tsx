// Built directly on @radix-ui/react-dialog rather than @lshay/ui's DialogContent
// wrapper: that wrapper bakes in a hardcoded English "Close" accessible label
// (see its compiled output), which this design system must not ship for a
// candidate-facing, English/Urdu product. Radix gives the same accessible,
// focus-trapped, ESC-to-close behavior; we own every visible/announced string.
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export interface DialogContentProps {
  /** Already-translated dialog title (required -- every dialog needs an accessible name). */
  title: string;
  /** Already-translated supporting text. */
  description?: string;
  /** Already-translated accessible name for the close (X) control. */
  closeLabel: string;
  children?: ReactNode;
}

export function DialogContent({ title, description, closeLabel, children }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-surface-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content className="fixed start-1/2 top-1/2 z-modal grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
        <div>
          <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-4 top-4 rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  onConfirm: () => void;
  confirmVariant?: ButtonVariant;
  isConfirming?: boolean;
  /** Extra content between the description and the footer -- e.g. a ValidationMessage surfacing why a prior confirm attempt failed (the dialog stays open on failure, so that error must render somewhere inside it, not off in the page behind the overlay). */
  children?: ReactNode;
}

/** Composed confirmation dialog for destructive/consequential actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  confirmVariant = 'primary',
  isConfirming = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} closeLabel={closeLabel}>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={isConfirming}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
