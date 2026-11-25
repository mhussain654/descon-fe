import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, Mail, X } from 'lucide-react-native';
import { Text } from '../../../../design-system/Text';
import { TextField, getFontFamily } from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { themed, themedStyles } from '../../../../design-system/theme';
import { physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { EMAIL_MAX_LENGTH } from '../../../../../../shared/candidateProfile/email';
import { CANDIDATE_PROFILE_ERROR_KEYS } from '../../../../../../shared/candidateProfile/errorMessages';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { GradientIconBox } from '../../home/GradientIconBox';
import { useProfileEmail, type ProfileEmailProblem } from '../hooks/useProfileEmail';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };

function problemMessage(problem: ProfileEmailProblem, t: LocaleProps['t']): string {
  if (problem.kind === 'invalid') return t('candidateProfileEmailInvalidError');
  if (problem.error.code === 'INVALID_EMAIL') return problem.error.message || t('candidateProfileEmailInvalidError');
  return t(CANDIDATE_PROFILE_ERROR_KEYS[problem.error.code] as TranslationKey);
}

/**
 * The Personal information block's email row: shows the candidate's email (or
 * "Not added yet") with an Add/Edit button that turns the value into an input
 * in place, with save (check) and cancel (cross) buttons beside it. Staff
 * use this address for mailing. An address always reads left to right.
 */
export function ProfileEmailRow({ email, language, t }: LocaleProps & { email: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(email ?? '');
  const { save, isSaving, problem, clearProblem } = useProfileEmail(() => setEditing(false));
  const rtl = language === 'ur';
  const text = { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(rtl ? 'right' : 'left'), writingDirection: rtl ? ('rtl' as const) : ('ltr' as const) };

  const startEditing = () => {
    setDraft(email ?? '');
    clearProblem();
    setEditing(true);
  };

  return (
    <View style={[styles.row, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
      <GradientIconBox icon={Mail} tone="green" size={34} />
      <View style={styles.flex}>
        <Text style={[styles.label, text]}>{t('candidateProfileEmailLabel')}</Text>
        {editing ? (
          <View style={styles.inlineField}>
            <TextField
              accessibilityLabel={t('candidateProfileEmailLabel')}
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (problem) clearProblem();
              }}
              onSubmitEditing={() => save(draft)}
              returnKeyType="done"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              maxLength={EMAIL_MAX_LENGTH}
              placeholder="name@example.com"
              helperText={problem ? undefined : t('candidateProfileEmailHelper')}
              errorMessage={problem ? problemMessage(problem, t) : undefined}
              editable={!isSaving}
              language={language}
            />
          </View>
        ) : email ? (
          <Text style={[styles.value, text, styles.address]}>{email}</Text>
        ) : (
          <Text style={[styles.value, text, { fontFamily: getFontFamily(language, 'medium') }]}>{t('candidateProfileEmailNotAdded')}</Text>
        )}
      </View>
      {editing ? (
        <View style={[styles.inlineActions, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
          {isSaving ? (
            <ActivityIndicator accessibilityLabel={t('save')} color={colors.brand.default} />
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={t('save')} onPress={() => save(draft)} hitSlop={6} style={({ pressed }) => [styles.iconButton, styles.saveButton, pressed && styles.pressed]}>
                <Check size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('candidateDocumentsCancel')} onPress={() => setEditing(false)} hitSlop={6} style={({ pressed }) => [styles.iconButton, styles.cancelButton, pressed && styles.pressed]}>
                <X size={18} color={themed('#42526E', '#CBD5E1')} />
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(email ? 'candidateProfileEmailEditAction' : 'candidateProfileEmailAddAction')}
          onPress={startEditing}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, { fontFamily: getFontFamily(language, 'bold') }]}>{t(email ? 'candidateProfileEmailEdit' : 'candidateProfileEmailAdd')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { gap: spacing[3], alignItems: 'flex-start' as const, paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: themed('#EDF2FA', '#334155') },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, lineHeight: 18, color: themed('#687A95', '#94A3B8') },
  value: { fontSize: 13, lineHeight: 21, color: themed('#172B4D', '#A9BFE5'), marginTop: 2 },
  address: { writingDirection: 'ltr' as const, fontFamily: getFontFamily('en', 'medium') },
  inlineField: { marginTop: spacing[1] },
  action: { alignSelf: 'center' as const, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 8, backgroundColor: themed('#E8F2FC', '#1E3A5F') },
  actionText: { fontSize: 12, color: themed('#0065B3', '#7CB8F0') },
  inlineActions: { gap: spacing[2], marginTop: 24, minHeight: 36, alignItems: 'center' as const },
  iconButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  saveButton: { backgroundColor: colors.brand.default },
  cancelButton: { borderWidth: 1, borderColor: themed('#DDE5F0', '#334155'), backgroundColor: themed('#FFFFFF', '#1E293B') },
  pressed: { opacity: 0.7 },
}));
