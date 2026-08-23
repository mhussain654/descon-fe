// Thin semantic wrapper over sonner, which is already mounted globally via
// `<Toaster />` in src/app/root.tsx (added in MPS-F101). Sonner's built-in
// success/error/warning/info variants each ship their own icon, so status
// here is never conveyed by color alone.
import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  /** Already-translated supporting text shown under the title. */
  description?: string;
  durationMs?: number;
}

function showToast(kind: 'success' | 'error' | 'warning' | 'info', title: string, options?: ToastOptions) {
  sonnerToast[kind](title, {
    description: options?.description,
    duration: options?.durationMs,
  });
}

/** Already-translated `title`/`description` in, toast out -- this module owns no copy of its own. */
export const toast = {
  success: (title: string, options?: ToastOptions) => showToast('success', title, options),
  error: (title: string, options?: ToastOptions) => showToast('error', title, options),
  warning: (title: string, options?: ToastOptions) => showToast('warning', title, options),
  info: (title: string, options?: ToastOptions) => showToast('info', title, options),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
