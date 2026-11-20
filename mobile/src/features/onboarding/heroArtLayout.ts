// The onboarding hero artwork (welcome-hero.webp and its mirrored Urdu copy).
export const HERO_ASPECT_RATIO = 1350 / 1388;

// Fractions of the artwork's height, measured on the image itself. On the
// copy's side, the skyline and its haze start at about 57% of the way down;
// everything above that is open sky.
const SKYLINE_TOP = 0.56;
// Below about 89% is plain pale ground, so the sheet can cover a little of it
// and leave the helmet and briefcase in full view.
const PLAIN_GROUND = 0.09;
// Air between the tagline banner and the skyline. The banner is tilted, so its
// lower corner sits a few points below its measured frame.
const CLEARANCE = 14;

export interface HeroArtLayout {
  /** The artwork at full screen width, never cropped or scaled up. */
  artHeight: number;
  /** How far down the artwork starts; the gap above it is filled with sky. */
  artTop: number;
  heroHeight: number;
  /** How much of the plain ground the sheet below may slide over. */
  sheetOverlap: number;
}

/**
 * Places the artwork so the copy over it (logo, heading and tagline banner)
 * ends in open sky above the skyline, as in the client-approved design: the
 * artwork moves down by however much the copy needs, instead of the copy
 * covering the landmarks. `copyBottom` is where the copy ends, measured from
 * the hero's top; null until it has been laid out.
 */
export function heroArtLayout(width: number, copyBottom: number | null): HeroArtLayout {
  const artHeight = width / HERO_ASPECT_RATIO;
  const artTop = copyBottom == null ? 0 : Math.max(0, Math.ceil(copyBottom + CLEARANCE - artHeight * SKYLINE_TOP));
  return {
    artHeight,
    artTop,
    heroHeight: artTop + artHeight,
    sheetOverlap: Math.round(artHeight * PLAIN_GROUND),
  };
}
