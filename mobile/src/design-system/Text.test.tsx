import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { getFontFamily } from './fonts';
import { NASTALIQ_FAMILY_PREFIX, Text, nastaliqFontSize, nastaliqLineHeight, nastaliqPadding } from './Text';

const styleOf = (name: string) => StyleSheet.flatten(screen.getByText(name).props.style);
const lineHeightOf = (name: string) => styleOf(name).lineHeight;

describe('Text', () => {
  it('keeps the prefix in sync with every Urdu font family the app loads', () => {
    for (const weight of ['regular', 'medium', 'semibold', 'bold'] as const) {
      expect(getFontFamily('ur', weight).startsWith(NASTALIQ_FAMILY_PREFIX)).toBe(true);
      expect(getFontFamily('en', weight).startsWith(NASTALIQ_FAMILY_PREFIX)).toBe(false);
    }
  });

  it('gives Urdu text twice its font size as line height when the style is tighter', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'bold'), fontSize: 25, lineHeight: 34 }}>پروفائل</Text>);
    expect(lineHeightOf('پروفائل')).toBe(50);
  });

  it('adds a line height when an Urdu style sets none, using the default size', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'regular') }}>مدد</Text>);
    expect(lineHeightOf('مدد')).toBe(28);
  });

  it('raises Urdu text below the minimum size, and sizes its line height from the raised size', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'bold'), fontSize: 11, lineHeight: 24 }}>جاری</Text>);
    expect(styleOf('جاری').fontSize).toBe(14);
    expect(lineHeightOf('جاری')).toBe(28);
  });

  it('leaves Urdu text at or above the minimum size alone', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'regular'), fontSize: 18, lineHeight: 40 }}>مکمل</Text>);
    expect(styleOf('مکمل').fontSize).toBe(18);
  });

  it('adds room for the ink to overhang and hang below, but not on sides the style already pads', () => {
    render(
      <>
        <Text style={{ fontFamily: getFontFamily('ur', 'regular'), fontSize: 20 }}>میرا</Text>
        <Text style={{ fontFamily: getFontFamily('ur', 'regular'), fontSize: 20, paddingStart: 2, paddingBottom: 1 }}>سفر</Text>
      </>
    );
    expect(styleOf('میرا')).toMatchObject({ paddingHorizontal: 8, paddingBottom: 7, paddingTop: 2 });
    expect(styleOf('سفر').paddingHorizontal).toBeUndefined();
    expect(styleOf('سفر').paddingBottom).toBe(1);
    expect(styleOf('سفر').paddingTop).toBe(2);
  });

  it('uses the simple line-break mode so a content-sized Urdu text never loses its last word', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'regular') }}>میرا سفر</Text>);
    expect(screen.getByText('میرا سفر').props.textBreakStrategy).toBe('simple');
  });

  it('never gives English text a size, line height, padding or break mode of its own', () => {
    render(<Text style={{ fontFamily: getFontFamily('en', 'regular'), fontSize: 11 }}>Profile</Text>);
    expect(styleOf('Profile')).toEqual({ fontFamily: getFontFamily('en', 'regular'), fontSize: 11 });
    expect(screen.getByText('Profile').props.textBreakStrategy).toBeUndefined();
  });

  it('computes the size and overhang from the raised size', () => {
    expect(nastaliqFontSize(undefined)).toBe(14);
    expect(nastaliqFontSize(12)).toBe(14);
    expect(nastaliqFontSize(22)).toBe(22);
    expect(nastaliqPadding(14, {})).toEqual({ paddingHorizontal: 6, paddingBottom: 5, paddingTop: 1 });
    expect(nastaliqPadding(24, { paddingHorizontal: 0 })).toEqual({ paddingBottom: 8, paddingTop: 2 });
    expect(nastaliqPadding(24, { padding: 4 })).toEqual({});
  });

  it('computes nothing when the line height already suffices', () => {
    expect(nastaliqLineHeight(14, 28)).toBeUndefined();
    expect(nastaliqLineHeight(14, 20)).toBe(28);
    expect(nastaliqLineHeight(undefined, undefined)).toBe(28);
  });
});
