import { HERO_ASPECT_RATIO, heroArtLayout } from './heroArtLayout';

describe('heroArtLayout', () => {
  const width = 360;
  const artHeight = width / HERO_ASPECT_RATIO;

  it('shows the artwork at full width, never cropped, and from the top until the copy is measured', () => {
    expect(heroArtLayout(width, null)).toMatchObject({ artHeight, artTop: 0, heroHeight: artHeight });
  });

  it('keeps the artwork at the top when the copy already ends in open sky', () => {
    expect(heroArtLayout(width, 120).artTop).toBe(0);
  });

  it('moves the artwork down so the tagline ends above the skyline instead of covering it', () => {
    const copyBottom = 300;
    const { artTop, heroHeight } = heroArtLayout(width, copyBottom);

    const skylineTop = artTop + artHeight * 0.56;
    expect(skylineTop).toBeGreaterThanOrEqual(copyBottom + 14);
    expect(heroHeight).toBe(artTop + artHeight);
  });

  it('lets the sheet cover only the plain ground below the helmet', () => {
    expect(heroArtLayout(width, null).sheetOverlap).toBe(Math.round(artHeight * 0.09));
  });
});
