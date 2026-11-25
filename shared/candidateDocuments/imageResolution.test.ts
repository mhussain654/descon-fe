// Runs under both web's Vitest and mobile's Jest (globals in both).
import { firstTooSmallImage, isImageTooSmall, MIN_IMAGE_SIDE } from './imageResolution';

describe('imageResolution', () => {
  it('needs both sides to be at least 500 pixels, whichever way the photo is held', () => {
    expect(MIN_IMAGE_SIDE).toBe(500);
    expect(isImageTooSmall({ width: 500, height: 500 })).toBe(false);
    expect(isImageTooSmall({ width: 4000, height: 3000 })).toBe(false);
    expect(isImageTooSmall({ width: 499, height: 2000 })).toBe(true);
    expect(isImageTooSmall({ width: 2000, height: 499 })).toBe(true);
  });

  it('finds the first too-small size, skipping sizes that could not be read', () => {
    expect(firstTooSmallImage([null, { width: 800, height: 600 }])).toBeNull();
    expect(firstTooSmallImage([null, { width: 300, height: 900 }, { width: 100, height: 100 }])).toEqual({ width: 300, height: 900 });
    expect(firstTooSmallImage([])).toBeNull();
  });
});
