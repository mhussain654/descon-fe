import { I18nManager, Platform } from 'react-native';

export type PhysicalSide = 'left' | 'right';

/**
 * Whether the layout actually on screen runs right-to-left. Native layouts
 * mirror once the app reloads into Urdu (`I18nManager.forceRTL`), but React
 * Native Web always lays out left-to-right whatever that flag says.
 */
export function isLayoutRtl(): boolean {
  return Platform.OS !== 'web' && I18nManager.isRTL;
}

/**
 * Whether a physical side is the row's start side in the live layout -- so
 * placement keyed to the active *language* (which can differ from the layout
 * until the post-switch reload, and always does on web) lands where intended.
 */
export function isStartSide(side: PhysicalSide): boolean {
  return (side === 'left') !== isLayoutRtl();
}

/**
 * React Native swaps `textAlign: "left" | "right"` under an RTL layout, so the
 * value that lands text on a given physical side depends on that layout too.
 */
export function physicalTextAlign(side: PhysicalSide): PhysicalSide {
  if (!isLayoutRtl()) return side;
  return side === 'left' ? 'right' : 'left';
}
