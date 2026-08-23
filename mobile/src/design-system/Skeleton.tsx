import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from './tokens';

export interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
}

/** Placeholder shape shown while content is loading. Match its size to the final layout so nothing jumps once real content arrives. */
export function Skeleton({ style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.md, backgroundColor: colors.surface.sunken },
});
