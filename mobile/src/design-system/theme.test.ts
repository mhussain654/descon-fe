import { colors, getActiveScheme, setActiveScheme, themed, themedStyles, themedValues } from './theme';

describe('theme', () => {
  afterEach(() => setActiveScheme('light'));

  it('starts light, with the shared light colours', () => {
    expect(getActiveScheme()).toBe('light');
    expect(colors.surface.raised).toBe('#FFFFFF');
    expect(colors.text.primary).toBe('#111827');
  });

  it('returns the dark colours once the dark theme is active, keeping white text on coloured surfaces', () => {
    setActiveScheme('dark');

    expect(colors.surface.background).toBe('#0F172A');
    expect(colors.surface.raised).toBe('#1E293B');
    expect(colors.text.primary).toBe('#F1F5F9');
    expect(colors.text.inverse).toBe('#FFFFFF');
    expect(colors.brand.on).toBe('#FFFFFF');
  });

  it('picks the literal colour for the active theme', () => {
    expect(themed('#F0F7FF', '#0F172A')).toBe('#F0F7FF');
    setActiveScheme('dark');
    expect(themed('#F0F7FF', '#0F172A')).toBe('#0F172A');
  });

  it('builds stylesheets on first use, once per theme, with that theme’s colours', () => {
    const build = jest.fn(() => ({ card: { backgroundColor: colors.surface.raised } }));
    const styles = themedStyles(build);
    expect(build).not.toHaveBeenCalled();

    expect(styles.card).toEqual({ backgroundColor: '#FFFFFF' });
    expect(styles.card).toEqual({ backgroundColor: '#FFFFFF' });
    setActiveScheme('dark');
    expect(styles.card).toEqual({ backgroundColor: '#1E293B' });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('builds colour objects per theme too', () => {
    const tones = themedValues(() => ({ approved: { badge: themed('#DFF5E9', '#1E293B') } }));

    expect(tones.approved.badge).toBe('#DFF5E9');
    setActiveScheme('dark');
    expect(tones.approved.badge).toBe('#1E293B');
    expect(Object.keys(tones)).toEqual(['approved']);
  });
});
