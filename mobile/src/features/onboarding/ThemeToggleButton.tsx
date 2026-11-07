import { Moon, Sun } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { TranslationKey } from '../../../../shared/i18n/translations';

/**
 * Light/dark switch for the signed-out screens, where Profile is out of reach.
 * Sits on the hero artwork, so it is white on a translucent circle in both themes.
 */
export function ThemeToggleButton({ t, resumeRoute }: { t: (key: TranslationKey) => string; resumeRoute?: string }) {
  const { scheme, setScheme } = useTheme();
  const toDark = scheme !== 'dark';
  const Icon = toDark ? Moon : Sun;
  return (
    <Pressable
      onPress={() => setScheme(toDark ? 'dark' : 'light', resumeRoute)}
      accessibilityRole="button"
      accessibilityLabel={t(toDark ? 'themeSwitchToDark' : 'themeSwitchToLight')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon size={20} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  pressed: { opacity: 0.7 },
});
