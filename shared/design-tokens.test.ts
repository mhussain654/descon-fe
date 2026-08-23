// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { breakpoints, colors, motion, radii, spacing, typeScale, zIndex } from './design-tokens';

const HEX_OR_RGBA = /^(#[0-9A-Fa-f]{6}|rgba?\(.+\))$/;

describe('design-tokens', () => {
  it('defines every semantic color group with a default, subtle, emphasis and on-color', () => {
    const groups = [colors.brand, colors.success, colors.warning, colors.danger, colors.info];
    for (const group of groups) {
      expect(Object.keys(group).sort()).toEqual(['default', 'emphasis', 'on', 'subtle']);
      for (const value of Object.values(group)) {
        expect(value).toMatch(HEX_OR_RGBA);
      }
    }
  });

  it('keeps the spacing scale numerically ascending', () => {
    // Object.values()/Object.entries() order integer-like keys ("0", "1", "2", ...)
    // ascending numerically, then any non-integer-shaped keys ("0.5", "1.5") by
    // insertion order -- so this walks the declared *keys* (numerically sorted)
    // rather than relying on the object's own iteration order.
    const keys = Object.keys(spacing)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 1; i < keys.length; i += 1) {
      const prevKey = keys[i - 1] as keyof typeof spacing;
      const key = keys[i] as keyof typeof spacing;
      expect(spacing[key]).toBeGreaterThan(spacing[prevKey]);
    }
  });

  it('keeps radii and z-index scales free of duplicate values (except none/full boundaries)', () => {
    expect(radii.sm).toBeLessThan(radii.md);
    expect(radii.md).toBeLessThan(radii.lg);
    expect(radii.lg).toBeLessThan(radii.xl);

    const zValues = Object.values(zIndex);
    expect(new Set(zValues).size).toBe(zValues.length);
  });

  it('gives every type scale entry a line height taller than its font size', () => {
    for (const { fontSize, lineHeight } of Object.values(typeScale)) {
      expect(lineHeight).toBeGreaterThan(fontSize);
    }
  });

  it('keeps breakpoints ascending and motion durations positive', () => {
    const bp = Object.values(breakpoints);
    for (let i = 1; i < bp.length; i += 1) {
      expect(bp[i]).toBeGreaterThan(bp[i - 1]);
    }
    for (const value of Object.values(motion.duration)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});
