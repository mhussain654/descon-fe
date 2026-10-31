import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../../design-system/Text';
import { Image } from 'expo-image';
import { Camera, ImageIcon, Trash2, X } from 'lucide-react-native';
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
  const [isViewing, setViewing] = useState(false);
  const photo = useProfilePhoto();
  const font = (weight: 'regular' | 'semibold') => ({ fontFamily: getFontFamily(language, weight) });

  const run = (action: () => void) => {
    setChoosing(false);
    action();
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.avatar}
        onPress={photoUri ? () => setViewing(true) : undefined}
        disabled={!photoUri}
        accessibilityRole={photoUri ? 'button' : 'image'}
        accessibilityLabel={photoUri ? t('profilePhotoViewFullSize') : t('homeProfilePhoto')}
      >
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
      </Pressable>

      {photoUri ? (
        <PhotoViewer uri={photoUri} visible={isViewing} onClose={() => setViewing(false)} closeLabel={t('profilePhotoCloseViewer')} />
      ) : null}

      <Text style={[styles.hint, language === 'ur' && styles.hintUrdu, font('regular')]}>{t('profilePhotoOwnFaceHint')}</Text>

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
          style={[styles.photoAction, language === 'ur' && styles.photoActionUrdu]}
        >
          <Text style={[styles.link, language === 'ur' && styles.linkUrdu, font('semibold')]}>{photoUri ? t('profilePhotoChange') : t('profilePhotoAdd')}</Text>
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

/** The photo full size over a blurred copy of itself, so the face fills the screen without a hard frame. Tap anywhere to close. */
function PhotoViewer({ uri, visible, onClose, closeLabel }: { uri: string; visible: boolean; onClose: () => void; closeLabel: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.viewer} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} accessible={false} />
        <View style={styles.viewerShade} />
        <Image source={{ uri }} style={styles.viewerPhoto} contentFit="contain" accessible={false} />
        <View style={styles.viewerClose}>
          <X size={22} color={colors.text.inverse} />
        </View>
      </Pressable>
    </Modal>
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
  initial: { fontSize: 34, color: colors.text.inverse, fontFamily: getFontFamily('en', 'semibold') },
  savingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  status: { fontSize: 13, color: colors.text.secondary },
  photoAction: { minHeight: 34, paddingHorizontal: spacing[3], borderRadius: 10, backgroundColor: '#E7F1FF', borderWidth: 1, borderColor: '#A8CCFF', justifyContent: 'center' },
  photoActionUrdu: { minHeight: 48, paddingVertical: spacing[1], alignItems: 'center' },
  link: { fontSize: 12, color: '#0759B8' },
  linkUrdu: { lineHeight: 30, textAlign: 'center', includeFontPadding: true },
  options: { alignSelf: 'stretch', gap: spacing[2] },
  hint: { fontSize: 12, lineHeight: 17, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing[2] },
  hintUrdu: { lineHeight: 26 },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  viewerPhoto: { width: '92%', height: '75%' },
  viewerClose: { position: 'absolute', top: 56, end: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'center', justifyContent: 'center' },
});
