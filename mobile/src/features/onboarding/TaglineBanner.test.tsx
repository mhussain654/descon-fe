import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TaglineBanner } from './TaglineBanner';

function bannerRotation() {
  return (StyleSheet.flatten(screen.getByTestId('tagline-banner').props.style)?.transform ?? []) as Array<Record<string, string>>;
}

describe('TaglineBanner', () => {
  it('shows the tagline tilted up from the left in English, slanted like the design', () => {
    render(<TaglineBanner text="Your Gateway to Overseas Employment" language="en" side="left" />);

    const text = screen.getByText('Your Gateway to Overseas Employment');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ textAlign: 'center', transform: [{ skewX: '-10deg' }] });
    expect(bannerRotation()).toContainEqual({ rotate: '-3deg' });
  });

  it('mirrors for Urdu and never slants Nastaliq', () => {
    render(<TaglineBanner text="بیرونِ ملک روزگار کے لیے آپ کا راستہ" language="ur" side="right" />);

    const text = screen.getByText('بیرونِ ملک روزگار کے لیے آپ کا راستہ');
    expect(StyleSheet.flatten(text.props.style).transform).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ writingDirection: 'rtl', lineHeight: 34 });
    expect(bannerRotation()).toContainEqual({ rotate: '3deg' });
  });
});
