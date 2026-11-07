import { spacing } from '../../../design-system/tokens';
import { themed, themedStyles } from '../../../design-system/theme';

/** Shared white, softly-shadowed surface for every home-screen card. */
export const homeCardStyles = themedStyles(() => ({
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: themed('rgba(255, 255, 255, 0.96)', '#1E293B'),
    shadowColor: '#194887',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
}));
