import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { ForbiddenState } from './ForbiddenState';
import { LoadingState } from './LoadingState';
import { OfflineState } from './OfflineState';
import { RetryBanner } from './RetryBanner';
import { SessionExpiredState } from './SessionExpiredState';

describe('LoadingState', () => {
  it('announces the message via role=status', () => {
    render(<LoadingState message="Loading…" />);
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the title/description and an optional action', () => {
    const onAction = vi.fn();
    render(
      <EmptyState title="No candidates found" description="Try a different search." actionLabel="Clear filters" onAction={onAction} />
    );
    expect(screen.getByText('No candidates found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the action entirely when no handler is given', () => {
    render(<EmptyState title="No candidates found" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('announces itself as an alert and fires retry on click and keyboard activation', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Something went wrong." retryLabel="Retry" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders an already-translated Urdu message', () => {
    render(<ErrorState message="کچھ غلط ہو گیا۔" />);
    expect(screen.getByRole('alert')).toHaveTextContent('کچھ غلط ہو گیا۔');
  });
});

describe('RetryBanner', () => {
  it('is non-blocking (role=status) and exposes a retry action', () => {
    const onRetry = vi.fn();
    render(<RetryBanner message="Showing saved data." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('Showing saved data.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('OfflineState', () => {
  it('renders the offline title/description and an optional retry action', () => {
    const onRetry = vi.fn();
    render(<OfflineState title="You are offline" description="Check your connection." retryLabel="Retry" onRetry={onRetry} />);
    expect(screen.getByText('You are offline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ForbiddenState', () => {
  it('announces itself as an alert', () => {
    render(<ForbiddenState title="Access restricted" description="You do not have permission." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
  });
});

describe('SessionExpiredState', () => {
  it('requires and fires a sign-in-again action', () => {
    const onAction = vi.fn();
    render(
      <SessionExpiredState title="Session expired" description="Please sign in again." actionLabel="Sign in again" onAction={onAction} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
