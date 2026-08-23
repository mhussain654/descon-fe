// Mobile adapter over the canonical tokens (shared/design-tokens.ts). Web
// mirrors the same values into its Tailwind config; mobile imports them
// directly since React Native has no equivalent build-time config to load
// them into. Only genuinely native-specific additions (shadow/elevation,
// per-platform tuning) live here.
import { Platform } from 'react-native';
import { colors, fontWeights, minTouchTarget, motion, radii, spacing, typeScale, zIndex } from '../../../shared/design-tokens';

export { colors, fontWeights, minTouchTarget, motion, radii, spacing, typeScale, zIndex };

export type ElevationLevel = 'none' | 'sm' | 'md' | 'lg';

/** RN has no CSS box-shadow; elevation needs both iOS shadow* props and Android's single `elevation`. */
export const elevation: Record<ElevationLevel, object> = {
  none: {},
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
    android: { elevation: 1 },
    default: {},
  }) as object,
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
    android: { elevation: 3 },
    default: {},
  }) as object,
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
    android: { elevation: 6 },
    default: {},
  }) as object,
};
