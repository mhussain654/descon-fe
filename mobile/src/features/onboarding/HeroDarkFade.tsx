import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, isDarkTheme } from '../../design-system/theme';

/**
 * In the dark theme, fades the bottom of a hero artwork (its plain white ground
 * strip) into the dark page, so no white band or white corners show where the
 * sheet slides over it. Draws nothing in the light theme.
 */
export function HeroDarkFade({ height = 96 }: { height?: number }) {
  if (!isDarkTheme()) return null;
  return (
    <View pointerEvents="none" style={[styles.fade, { height }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="heroDarkFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.surface.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroDarkFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
