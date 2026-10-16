import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { getFontFamily } from './fonts';
import { NASTALIQ_FAMILY_PREFIX, Text, nastaliqLineHeight } from './Text';

const lineHeightOf = (name: string) => StyleSheet.flatten(screen.getByText(name).props.style).lineHeight;

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

  it('never shrinks a line height that is already generous', () => {
    render(<Text style={{ fontFamily: getFontFamily('ur', 'regular'), fontSize: 14, lineHeight: 40 }}>تربیت</Text>);
    expect(lineHeightOf('تربیت')).toBe(40);
  });

  it('leaves English text untouched', () => {
    render(<Text style={{ fontFamily: getFontFamily('en', 'regular'), fontSize: 14, lineHeight: 18 }}>Profile</Text>);
    expect(lineHeightOf('Profile')).toBe(18);
  });

  it('computes nothing when the line height already suffices', () => {
    expect(nastaliqLineHeight(14, 28)).toBeUndefined();
    expect(nastaliqLineHeight(14, 20)).toBe(28);
    expect(nastaliqLineHeight(undefined, undefined)).toBe(28);
  });
});
