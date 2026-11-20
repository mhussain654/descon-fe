import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TaglineBanner, slantedCardPath, taglineScale } from './TaglineBanner';

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
    const style = StyleSheet.flatten(text.props.style);
    expect(style).toMatchObject({ writingDirection: 'rtl', fontFamily: 'NotoNastaliqUrdu_700Bold' });
    // Nastaliq gets about twice the line height, whatever the screen's scale.
    expect(style.lineHeight / style.fontSize).toBeGreaterThan(2);
    expect(StyleSheet.flatten(text.props.style).transform).toBeUndefined();
    expect(transformOf('tagline-banner-band')).toEqual([{ rotate: '-4deg' }]);
  });
});

describe('taglineScale', () => {
  it('scales with the screen width from the 360-point design, so the gap to the globe stays the same', () => {
    expect(taglineScale(360)).toBe(1);
    expect(taglineScale(411)).toBeCloseTo(1.142, 3);
    expect(taglineScale(320)).toBeCloseTo(0.889, 3);
  });

  it('never shrinks below 0.8 or grows past 1.5 (tablets)', () => {
    expect(taglineScale(200)).toBe(0.8);
    expect(taglineScale(1024)).toBe(1.5);
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
