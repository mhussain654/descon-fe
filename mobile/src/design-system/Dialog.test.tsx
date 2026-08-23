import { fireEvent, render, screen } from '@testing-library/react-native';
import { ConfirmDialog } from './Dialog';

describe('ConfirmDialog', () => {
  it('renders nothing visible when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Remove document?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText('Remove document?')).not.toBeOnTheScreen();
  });

  it('shows the title/description and both actions when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Remove document?"
        description="This cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Remove document?')).toBeOnTheScreen();
    expect(screen.getByText('This cannot be undone.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('fires onConfirm from the confirm button', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Remove document?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
      />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes via onOpenChange(false) from the cancel button', () => {
    const onOpenChange = jest.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Remove document?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {}}
      />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions while confirming', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Remove document?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        isConfirming
      />
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
