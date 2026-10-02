import { StyleSheet } from 'react-native';
import { spacing } from '../../../design-system/tokens';

/** Shared white, softly-shadowed surface for every home-screen card. */
export const homeCardStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#194887',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
});
