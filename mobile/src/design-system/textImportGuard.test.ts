import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Text must come from design-system/Text so Urdu (Nastaliq) text always gets a line height tall
// enough for its dots and tails. Importing react-native's Text directly would silently bypass that.
const SRC_ROOT = join(__dirname, '..');
const NATIVE_TEXT_IMPORT = /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]react-native['"]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === '__mocks__' ? [] : sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

describe('Text import', () => {
  it("is never taken from 'react-native' outside design-system/Text.tsx", () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => !file.endsWith(join('design-system', 'Text.tsx')))
      .filter((file) => NATIVE_TEXT_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(SRC_ROOT, 'src'));

    expect(offenders).toEqual([]);
  });
});
