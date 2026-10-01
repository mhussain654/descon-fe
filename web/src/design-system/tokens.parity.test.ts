// web/tailwind.config.js mirrors shared/design-tokens.ts colors by hand
// (Tailwind's config loader runs in plain Node and can't import that
// TypeScript module directly -- see the comment in tailwind.config.js and
// web/src/design-system/README.md's "Tokens" section). This test is the
// automated guard against the two drifting apart: it fails the build the
// moment a value is changed in one place and not the other.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colors as sharedColors } from '../../../shared/design-tokens';
// @ts-expect-error -- plain CJS config, no type declarations.
import tailwindConfig from '../../tailwind.config.js';

type SemanticGroup = 'brand' | 'success' | 'warning' | 'danger' | 'info';
const GROUPS: SemanticGroup[] = ['brand', 'success', 'warning', 'danger', 'info'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads a `--variable-name: value;` declaration out of global.css's `:root`
 * block (the light theme -- see the `.dark` block below it for the admin
 * portal's dark-theme overrides, which this parity check doesn't cover).
 */
function readRootCssVariable(name: string): string {
  const css = readFileSync(path.resolve(__dirname, '../app/global.css'), 'utf-8');
  const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('.dark {'));
  const match = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} not found in global.css's :root block`);
  return match[1].trim();
}

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

  // text/surface/borderStrong are CSS-variable-backed (not literal hex) so
  // the admin portal's dark theme can re-theme them -- see global.css's
  // `:root`/`.dark` blocks and AdminThemeContext.tsx. Parity now has two
  // parts: tailwind.config.js must reference the expected variable names,
  // and global.css's `:root` (light) values for those same variables must
  // still match shared/design-tokens.ts exactly.
  it('neutral text/surface/border colors reference the expected CSS variables', () => {
    expect(tailwindColors.text).toEqual({
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      tertiary: 'var(--text-tertiary)',
      disabled: 'var(--text-disabled)',
      inverse: 'var(--text-inverse)',
    });
    expect(tailwindColors.surface).toEqual({
      background: 'var(--surface-background)',
      raised: 'var(--surface-raised)',
      sunken: 'var(--surface-sunken)',
    });
    expect(tailwindColors.borderStrong).toBe('var(--border-strong)');
  });

  it("global.css's :root (light theme) values for those variables match shared/design-tokens.ts", () => {
    expect(readRootCssVariable('text-primary')).toBe(sharedColors.text.primary);
    expect(readRootCssVariable('text-secondary')).toBe(sharedColors.text.secondary);
    expect(readRootCssVariable('text-tertiary')).toBe(sharedColors.text.tertiary);
    expect(readRootCssVariable('text-disabled')).toBe(sharedColors.text.disabled);
    expect(readRootCssVariable('text-inverse')).toBe(sharedColors.text.inverse);
    expect(readRootCssVariable('surface-background')).toBe(sharedColors.surface.background);
    expect(readRootCssVariable('surface-raised')).toBe(sharedColors.surface.raised);
    expect(readRootCssVariable('surface-sunken')).toBe(sharedColors.surface.sunken);
    expect(readRootCssVariable('border-strong')).toBe(sharedColors.border.strong);
  });
});
