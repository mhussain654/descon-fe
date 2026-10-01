import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useDismissableMenu } from './useDismissableMenu';

function Probe() {
  const [isOpen, setIsOpen] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);
  useDismissableMenu(ref, isOpen, () => setIsOpen(false));

  return (
    <div>
      <div ref={ref} data-testid="menu">
        {isOpen ? 'open' : 'closed'}
      </div>
      <button type="button">outside</button>
    </div>
  );
}

describe('useDismissableMenu', () => {
  it('closes on a click outside the given ref', () => {
    render(<Probe />);
    expect(screen.getByTestId('menu')).toHaveTextContent('open');

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));

    expect(screen.getByTestId('menu')).toHaveTextContent('closed');
  });

  it('does not close on a click inside the given ref', () => {
    render(<Probe />);

    fireEvent.mouseDown(screen.getByTestId('menu'));

    expect(screen.getByTestId('menu')).toHaveTextContent('open');
  });

  it('closes on Escape', () => {
    render(<Probe />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByTestId('menu')).toHaveTextContent('closed');
  });

  it('does nothing once already closed', () => {
    render(<Probe />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('menu')).toHaveTextContent('closed');

    // A further outside click / Escape while closed should not throw or
    // otherwise misbehave -- the effect is a no-op once isOpen is false.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('menu')).toHaveTextContent('closed');
  });
});
