import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, ImageIcon, Trash2 } from 'lucide-react-native';
import { Button, ValidationMessage, getFontFamily } from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useProfilePhoto, type ProfilePhotoProblem } from '../hooks/useProfilePhoto';

interface ProfilePhotoEditorProps {
  language: 'en' | 'ur';
  t: (key: TranslationKey) => string;
  fullName: string;
  /** Absolute, validated photo URL, or null to show the initial. */
  photoUri: string | null;
}

function problemMessage(problem: ProfilePhotoProblem, t: (key: TranslationKey) => string): string {
  switch (problem.kind) {
    case 'too_large':
      return t('profilePhotoTooLarge');
    case 'unsupported':
      return t('profilePhotoUnsupported');
    case 'permission':
      if (problem.blocked) return t('profilePhotoPermissionBlocked');
      return t(problem.source === 'camera' ? 'profilePhotoCameraDenied' : 'profilePhotoGalleryDenied');
    case 'failed':
      // The backend's own localized validation message is the most specific one available.
      return problem.error.message || t('profilePhotoFailed');
  }
}

/** The profile header's photo: shows it (or the initial), and lets the candidate take, choose or remove one. */
export function ProfilePhotoEditor({ language, t, fullName, photoUri }: ProfilePhotoEditorProps) {
  const [isChoosing, setChoosing] = useState(false);
  const photo = useProfilePhoto();
  const font = (weight: 'regular' | 'semibold') => ({ fontFamily: getFontFamily(language, weight) });

  const run = (action: () => void) => {
    setChoosing(false);
    action();
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar} accessible accessibilityRole="image" accessibilityLabel={t('homeProfilePhoto')}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Text style={styles.initial}>{fullName.trim().charAt(0).toUpperCase()}</Text>
        )}
        {photo.isSaving ? (
          <View style={styles.savingOverlay}>
            <ActivityIndicator color={colors.text.inverse} />
          </View>
        ) : null}
      </View>

      {photo.isSaving ? (
        <Text style={[styles.status, font('regular')]}>{t('profilePhotoUploading')}</Text>
      ) : isChoosing ? (
        <View style={styles.options}>
          <Button variant="outline" size="sm" fullWidth language={language} onPress={() => run(photo.takePhoto)} leadingIcon={<Camera size={16} color={colors.text.primary} />}>
            {t('profilePhotoTake')}
          </Button>
          <Button variant="outline" size="sm" fullWidth language={language} onPress={() => run(photo.chooseFromGallery)} leadingIcon={<ImageIcon size={16} color={colors.text.primary} />}>
            {t('profilePhotoChoose')}
          </Button>
          {photoUri ? (
            <Button variant="outline" size="sm" fullWidth language={language} onPress={() => run(photo.removePhoto)} leadingIcon={<Trash2 size={16} color={colors.danger.default} />}>
              {t('profilePhotoRemove')}
            </Button>
          ) : null}
          <Button variant="text" size="sm" fullWidth language={language} onPress={() => setChoosing(false)}>
            {t('profilePhotoCancel')}
          </Button>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            photo.clearProblem();
            setChoosing(true);
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.photoAction}
        >
          <Text style={[styles.link, font('semibold')]}>{photoUri ? t('profilePhotoChange') : t('profilePhotoAdd')}</Text>
        </Pressable>
      )}

      {photo.problem ? (
        <ValidationMessage tone="error" language={language}>
          {problemMessage(photo.problem, t)}
        </ValidationMessage>
      ) : null}
    </View>
  );
}

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#BFDDFB',
    backgroundColor: colors.brand.default,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  initial: { fontSize: 34, fontWeight: '700', color: colors.text.inverse, fontFamily: getFontFamily('en', 'semibold') },
  savingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  status: { fontSize: 13, color: colors.text.secondary },
  photoAction: { minHeight: 34, paddingHorizontal: spacing[3], borderRadius: 10, backgroundColor: '#E7F1FF', borderWidth: 1, borderColor: '#A8CCFF', justifyContent: 'center' },
  link: { fontSize: 12, color: '#0759B8' },
  options: { alignSelf: 'stretch', gap: spacing[2] },
});
