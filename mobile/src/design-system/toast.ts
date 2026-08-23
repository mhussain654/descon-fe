// Thin semantic wrapper over sonner-native, which mirrors sonner's API used
// on web. Mount `<Toaster />` (re-exported below) once near the app root --
// see mobile/src/app/_layout.jsx -- the same place web mounts sonner's.
import { toast as sonnerToast, Toaster } from 'sonner-native';

export { Toaster };

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
