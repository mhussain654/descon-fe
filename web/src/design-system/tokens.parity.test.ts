// web/tailwind.config.js mirrors shared/design-tokens.ts colors by hand
// (Tailwind's config loader runs in plain Node and can't import that
// TypeScript module directly -- see the comment in tailwind.config.js and
// web/src/design-system/README.md's "Tokens" section). This test is the
// automated guard against the two drifting apart: it fails the build the
// moment a value is changed in one place and not the other.
import { describe, expect, it } from 'vitest';
import { colors as sharedColors } from '../../../shared/design-tokens';
// @ts-expect-error -- plain CJS config, no type declarations.
import tailwindConfig from '../../tailwind.config.js';

type SemanticGroup = 'brand' | 'success' | 'warning' | 'danger' | 'info';
const GROUPS: SemanticGroup[] = ['brand', 'success', 'warning', 'danger', 'info'];

describe('tailwind.config.js color mirror stays in sync with shared/design-tokens.ts', () => {
  const tailwindColors = tailwindConfig.theme.extend.colors;

  it.each(GROUPS)('%s subtle/DEFAULT/emphasis/on hex values match', (group) => {
    const shared = sharedColors[group];
    const tailwind = tailwindColors[group];

    expect(tailwind.subtle).toBe(shared.subtle);
    expect(tailwind.DEFAULT).toBe(shared.default);
    expect(tailwind.emphasis).toBe(shared.emphasis);
    expect(tailwind.on).toBe(shared.on);
  });

  it('neutral text/surface/border colors match', () => {
    expect(tailwindColors.text).toEqual(sharedColors.text);
    expect(tailwindColors.surface).toEqual({
      background: sharedColors.surface.background,
      raised: sharedColors.surface.raised,
      sunken: sharedColors.surface.sunken,
    });
    expect(tailwindColors.borderStrong).toBe(sharedColors.border.strong);
  });
});
