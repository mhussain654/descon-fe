import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its text', () => {
    render(<Badge tone="success">Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('pairs every tone with a visible icon so status is not conveyed by color alone', () => {
    const tones = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const;
    for (const tone of tones) {
      const { container, unmount } = render(<Badge tone={tone}>Status</Badge>);
      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon, `tone "${tone}" should render an icon`).not.toBeNull();
      unmount();
    }
  });

  it('allows the default icon to be overridden or hidden', () => {
    const { container: withCustom } = render(
      <Badge tone="success" icon={<span data-icon="custom" />}>
        Verified
      </Badge>
    );
    expect(withCustom.querySelector('[data-icon="custom"]')).not.toBeNull();

    const { container: withoutIcon } = render(
      <Badge tone="success" icon={null}>
        Verified
      </Badge>
    );
    expect(withoutIcon.querySelector('svg')).toBeNull();
  });

  it('renders an already-translated Urdu label', () => {
    render(<Badge tone="warning">زیر التواء</Badge>);
    expect(screen.getByText('زیر التواء')).toBeInTheDocument();
  });
});
