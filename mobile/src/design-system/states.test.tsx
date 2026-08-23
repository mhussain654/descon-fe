import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { ForbiddenState } from './ForbiddenState';
import { LoadingState } from './LoadingState';
import { OfflineState } from './OfflineState';
import { RetryBanner } from './RetryBanner';
import { SessionExpiredState } from './SessionExpiredState';

describe('LoadingState', () => {
  it('announces the message via progressbar role', () => {
    render(<LoadingState message="Loading…" />);
    expect(screen.getByRole('progressbar', { name: 'Loading…' })).toBeOnTheScreen();
  });
});

describe('EmptyState', () => {
  it('renders the title/description and an optional action', () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No candidates found" description="Try a different search." actionLabel="Clear filters" onAction={onAction} />
    );
    expect(screen.getByText('No candidates found')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the action entirely when no handler is given', () => {
    render(<EmptyState title="No candidates found" />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('fires retry on press', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Something went wrong." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByText('Something went wrong.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders an already-translated Urdu message', () => {
    render(<ErrorState message="کچھ غلط ہو گیا۔" />);
    expect(screen.getByText('کچھ غلط ہو گیا۔')).toBeOnTheScreen();
  });
});

describe('RetryBanner', () => {
  it('exposes a retry action alongside the message', () => {
    const onRetry = jest.fn();
    render(<RetryBanner message="Showing saved data." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByText('Showing saved data.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('OfflineState', () => {
  it('renders the offline title/description and an optional retry action', () => {
    const onRetry = jest.fn();
    render(<OfflineState title="You are offline" description="Check your connection." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByText('You are offline')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ForbiddenState', () => {
  it('renders the title/description', () => {
    render(<ForbiddenState title="Access restricted" description="You do not have permission." />);
    expect(screen.getByText('Access restricted')).toBeOnTheScreen();
  });
});

describe('SessionExpiredState', () => {
  it('requires and fires a sign-in-again action', () => {
    const onAction = jest.fn();
    render(
      <SessionExpiredState title="Session expired" description="Please sign in again." actionLabel="Sign in again" onAction={onAction} />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
