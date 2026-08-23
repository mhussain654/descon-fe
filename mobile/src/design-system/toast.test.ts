jest.mock('sonner-native', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  },
  Toaster: () => null,
}));

import { toast as sonnerToast } from 'sonner-native';
import { toast } from './toast';

describe('toast', () => {
  it('forwards success/error/warning/info to the matching sonner-native method with title and description', () => {
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
