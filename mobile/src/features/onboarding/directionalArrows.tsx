import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { isStartSide } from '../../lib/layoutDirection';

interface ArrowSlots {
  leadingIcon: ReactNode;
  trailingIcon: ReactNode;
}

/**
 * Button icon slots for a "go forward" action (Continue, Send OTP...): the
 * arrow points onward in reading direction and sits at the reading end --
 * right-pointing on the right for English, left-pointing on the left for Urdu.
 */
export function forwardArrowSlots(language: string, color: string, size = 20): ArrowSlots {
  const isUrdu = language === 'ur';
  const arrow = (
    <View accessible={false}>
      {isUrdu ? (
        <ArrowLeft size={size} color={color} strokeWidth={2.5} />
      ) : (
        <ArrowRight size={size} color={color} strokeWidth={2.5} />
      )}
    </View>
  );
  return isStartSide(isUrdu ? 'left' : 'right')
    ? { leadingIcon: arrow, trailingIcon: null }
    : { leadingIcon: null, trailingIcon: arrow };
}

/** A "go back" arrow: points against reading direction (left in English, right in Urdu). */
export function BackArrow({ language, color, size = 18 }: { language: string; color: string; size?: number }) {
  return language === 'ur' ? (
    <ArrowRight size={size} color={color} strokeWidth={2.5} />
  ) : (
    <ArrowLeft size={size} color={color} strokeWidth={2.5} />
  );
}
