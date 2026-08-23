import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Badge, type BadgeTone } from './Badge';

describe('Badge', () => {
  it('renders its text', () => {
    render(<Badge tone="success">Verified</Badge>);
    expect(screen.getByText('Verified')).toBeOnTheScreen();
  });

  it('pairs every tone with a visible icon by default, so status is not conveyed by color alone', () => {
    const tones: BadgeTone[] = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'];
    for (const tone of tones) {
      const { toJSON, unmount } = render(<Badge tone={tone}>Status</Badge>);
      const badgeChildren = toJSON()?.children ?? [];
      expect(badgeChildren.length).toBe(2);
      unmount();
    }
  });

  it('renders only the text when the icon is explicitly hidden', () => {
    const { toJSON } = render(
      <Badge tone="success" icon={null}>
        Verified
      </Badge>
    );
    expect(toJSON()?.children?.length).toBe(1);
  });

  it('allows the default icon to be overridden', () => {
    render(
      <Badge tone="success" icon={<Text>custom-icon</Text>}>
        Verified
      </Badge>
    );
    expect(screen.getByText('custom-icon')).toBeOnTheScreen();
  });

  it('renders an already-translated Urdu label', () => {
    render(<Badge tone="warning">زیر التواء</Badge>);
    expect(screen.getByText('زیر التواء')).toBeOnTheScreen();
  });
});
