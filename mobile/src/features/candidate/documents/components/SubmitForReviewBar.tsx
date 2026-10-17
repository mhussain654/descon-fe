import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Text } from '../../../../design-system/Text';
import { Button, getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { physicalTextAlign } from '../../../../lib/layoutDirection';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';

type SubmitForReviewBarProps = {
  onSubmit: () => void;
  disabled: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
};

/**
 * Pinned above the tab bar once every document is uploaded, so the candidate
 * always sees the next step without scrolling. Hidden while the keyboard is
 * open, since the bank-details fields sit at the bottom of this screen and the
 * bar would otherwise cover them.
 */
export function SubmitForReviewBar({ onSubmit, disabled, language, t }: SubmitForReviewBarProps) {
  const keyboardVisible = useKeyboardVisible();
  if (keyboardVisible) return null;

  const isUrdu = language === 'ur';
  return (
    <View style={styles.bar}>
      <Text
        style={[
          styles.message,
          { fontFamily: getFontFamily(language, 'bold'), textAlign: physicalTextAlign(isUrdu ? 'right' : 'left') },
          isUrdu && styles.messageUrdu,
        ]}
      >
        {t('candidateDocumentsReadyToSubmit')}
      </Text>
      <Button onPress={onSubmit} disabled={disabled} language={language}>
        {t('applicationProgressSubmitAction')}
      </Button>
    </View>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: '#D6E6F7',
    ...elevation.sm,
  },
  message: { fontSize: 13, lineHeight: 19, color: '#1A4178' },
  messageUrdu: { lineHeight: 28 },
});
