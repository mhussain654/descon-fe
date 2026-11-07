import { useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CandidateProfile } from '../../../../../../shared/candidateProfile/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

const SEEN_KEY = 'descon.photoRejectionSeen';

/**
 * When staff reject the candidate's photo (it must clearly show their own
 * face), tells them once with a popup. Each rejection is shown once: the
 * decision time is remembered after the candidate taps OK.
 */
export function usePhotoRejectedNotice(profile: CandidateProfile | undefined, t: (key: TranslationKey) => string) {
  const rejectedAt = profile?.photoStatus === 'rejected' ? profile.photoReviewedAt ?? 'rejected' : null;

  useEffect(() => {
    if (!rejectedAt) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY)
      .catch(() => null)
      .then((seen) => {
        if (cancelled || seen === rejectedAt) return;
        Alert.alert(t('profilePhotoRejectedTitle'), t('profilePhotoRejectedMessage'), [
          { text: t('profilePhotoRejectedAction'), onPress: () => AsyncStorage.setItem(SEEN_KEY, rejectedAt).catch(() => undefined) },
        ]);
      });
    return () => {
      cancelled = true;
    };
  }, [rejectedAt, t]);
}
