import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Why this exists: expo-font registers every loaded font file under its own
// family name for the NORMAL style slot only (the weight is baked into the
// file: Inter_700Bold, NotoNastaliqUrdu_700Bold, ...). On Android, React Native
// turns any numeric fontWeight >= 700 into a request for that family's BOLD
// slot, which was never registered, so the text silently falls back to the
// phone's default font -- the upright Naskh Urdu / Roboto seen on devices while
// the browser (which resolves CSS weights differently) looks correct.
// Bold text must therefore come from getFontFamily(language, 'bold'), never
// from a fontWeight of 700 or more. Weights below 700 are harmless.
const SRC_ROOT = join(__dirname, '..');
const BOLD_WEIGHT = /fontWeight\s*:\s*(?:fontWeights\.bold|['"]?(?:bold|[7-9]00)['"]?)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === '__mocks__' ? [] : sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

describe('Android custom-font weights', () => {
  it('never combines a custom font family with a fontWeight of 700 or more', () => {
    const offenders = sourceFiles(SRC_ROOT).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line.trim() }))
        .filter(({ text }) => BOLD_WEIGHT.test(text))
        .map(({ file: path, line, text }) => `${path.replace(SRC_ROOT, 'src')}:${line}  ${text}`)
    );

    expect(offenders).toEqual([]);
  });
});
