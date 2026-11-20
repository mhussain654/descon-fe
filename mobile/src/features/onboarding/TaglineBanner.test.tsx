import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TaglineBanner, slantedCardPath } from './TaglineBanner';

function transformOf(testID: string) {
  return (StyleSheet.flatten(screen.getByTestId(testID).props.style)?.transform ?? []) as Array<Record<string, string>>;
}

function layOut() {
  fireEvent(screen.getByTestId('tagline-banner-card'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 50 } } });
}

describe('TaglineBanner', () => {
  it('sets the English tagline in Inter Bold Italic on a card, with the red band turned behind it', () => {
    render(<TaglineBanner text={'Your Gateway to\nOverseas Employment'} language="en" side="left" />);
    layOut();

    const text = screen.getByText('Your Gateway to\nOverseas Employment');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ textAlign: 'center', fontFamily: 'Inter_700Bold_Italic' });
    // No skew anywhere: Android ignores it, so the slant is drawn instead.
    expect(transformOf('tagline-banner')).toEqual([]);
    expect(transformOf('tagline-banner-band')).toEqual([{ rotate: '4deg' }]);
  });

  it('mirrors for Urdu and keeps Nastaliq upright', () => {
    render(<TaglineBanner text={'بیرونِ ملک روزگار کے لیے\nآپ کا راستہ'} language="ur" side="right" />);
    layOut();

    const text = screen.getByText('بیرونِ ملک روزگار کے لیے\nآپ کا راستہ');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ writingDirection: 'rtl', lineHeight: 34, fontFamily: 'NotoNastaliqUrdu_700Bold' });
    expect(StyleSheet.flatten(text.props.style).transform).toBeUndefined();
    expect(transformOf('tagline-banner-band')).toEqual([{ rotate: '-4deg' }]);
  });
});

describe('slantedCardPath', () => {
  it('leans the ends toward the reading side: the top edge is shifted right for English', () => {
    const path = slantedCardPath(200, 40, 'left');
    // Starts near the top-left corner, which sits ~10 points in (40 * tan 14°).
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('Q10,0');
    expect(path).toContain('Q0,40');
    expect(path.endsWith('Z')).toBe(true);
  });

  it('mirrors for Urdu: the bottom edge is shifted right instead', () => {
    const path = slantedCardPath(200, 40, 'right');
    expect(path).toContain('Q0,0');
    expect(path).toContain('Q10,40');
  });
});
