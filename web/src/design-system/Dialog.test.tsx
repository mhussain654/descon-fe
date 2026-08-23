import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './Dialog';

function renderDialog(overrides: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Remove document?"
      description="This cannot be undone."
      confirmLabel="Remove"
      cancelLabel="Cancel"
      closeLabel="Close"
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { ...utils, onOpenChange, onConfirm };
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Remove document?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        closeLabel="Close"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title/description and both actions when open', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Remove document?' })).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('uses the already-translated closeLabel as the close control\'s accessible name, not a hardcoded "Close"', () => {
    renderDialog({ closeLabel: 'بند کریں' });
    expect(screen.getByRole('button', { name: 'بند کریں' })).toBeInTheDocument();
  });

  it('fires onConfirm from the confirm button', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes via onOpenChange(false) from the cancel button', () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape', () => {
    const { onOpenChange } = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions while confirming', () => {
    renderDialog({ isConfirming: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
