import { describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const { toast: sonnerToast } = await import('sonner');
const { toast } = await import('./toast');

describe('toast', () => {
  it('forwards success/error/warning/info to the matching sonner method with title and description', () => {
    toast.success('Saved', { description: 'Your changes were saved.' });
    expect(sonnerToast.success).toHaveBeenCalledWith('Saved', {
      description: 'Your changes were saved.',
      duration: undefined,
    });

    toast.error('کچھ غلط ہو گیا۔');
    expect(sonnerToast.error).toHaveBeenCalledWith('کچھ غلط ہو گیا۔', {
      description: undefined,
      duration: undefined,
    });
  });

  it('forwards dismiss', () => {
    toast.dismiss('toast-1');
    expect(sonnerToast.dismiss).toHaveBeenCalledWith('toast-1');
  });
});
