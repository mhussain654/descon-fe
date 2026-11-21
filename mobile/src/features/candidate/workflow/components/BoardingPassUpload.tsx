import { View } from 'react-native';
import { AlertCircle, CalendarClock, Camera, CheckCircle2, Eye, Image as ImageIcon } from 'lucide-react-native';
import { Button, ValidationMessage } from '../../../../design-system';
import { Text } from '../../../../design-system/Text';
import { spacing } from '../../../../design-system/tokens';
import { colors, themed, themedStyles } from '../../../../design-system/theme';
import { rowDirectionTowards } from '../../../../lib/layoutDirection';
import type { CandidateFlightDetail } from '../../../../../../shared/candidateFlightDetail/types';
import { CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS } from '../../../../../../shared/candidateFlightDetail/errorMessages';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import { formatShortDate } from '../../../../../../shared/i18n/locale';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { statusCopyStyle } from '../../progress/components/StatusPresentation';
import { useBoardingPassUpload, type BoardingPassProblem } from '../hooks/useBoardingPassUpload';
import { useBoardingPassView } from '../hooks/useFlightTicketAccess';

interface BoardingPassUploadProps {
  flight: CandidateFlightDetail;
  language: Language;
  t: (key: TranslationKey) => string;
}

function problemMessage(problem: BoardingPassProblem, t: (key: TranslationKey) => string): string {
  switch (problem.kind) {
    case 'too_large':
      return t('boardingPassTooLarge');
    case 'unsupported':
      return t('profilePhotoUnsupported');
    case 'permission':
      if (problem.blocked) return t('profilePhotoPermissionBlocked');
      return t(problem.source === 'camera' ? 'profilePhotoCameraDenied' : 'profilePhotoGalleryDenied');
    case 'failed':
      return problem.error.message || t(CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS[problem.error.code] as TranslationKey);
  }
}

function uploadedOn(iso: string, language: Language): string {
  return formatShortDate(iso, language);
}

/** A YYYY-MM-DD calendar day as the app's short date, read as that day wherever the phone is. */
function calendarDay(day: string, language: Language): string {
  const [year, month, date] = day.split('-').map(Number);
  return formatShortDate(new Date(year, month - 1, date, 12), language);
}

/** Staff rejected the photo: says so, with their reason, before the upload actions. */
function RejectionNotice({ reason, language, t }: { reason: string; language: Language; t: (key: TranslationKey) => string }) {
  const rowDirection = rowDirectionTowards(language === 'ur' ? 'right' : 'left');
  return (
    <View style={styles.rejection} accessibilityRole="alert">
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        <AlertCircle size={16} color={themed('#B42318', '#FDA29B')} />
        <Text style={[styles.rejectedTitle, styles.flex, statusCopyStyle(language, 14)]}>{t('boardingPassRejectedTitle')}</Text>
      </View>
      <Text style={[styles.rejectedReason, statusCopyStyle(language, 13)]}>
        {interpolate(t('boardingPassRejectedReason'), { reason })}
      </Text>
    </View>
  );
}

/**
 * The Mobilize Status step's boarding pass upload (client request, Nov 2026):
 * the candidate takes or picks a photo of their boarding pass, and can upload
 * it again to replace a wrong one. Uploading completes the step.
 *
 * Only open from 2 days before the flight's day to 2 days after (client
 * decision, Nov 2026). Before that the box says from when; after it, a sent
 * photo can still be viewed but no longer replaced.
 *
 * When staff reject the photo, the box shows their reason and asks for a new
 * one, as if nothing had been sent; the server keeps the window open for 2
 * days after a rejection.
 */
export function BoardingPassUpload({ flight, language, t }: BoardingPassUploadProps) {
  const upload = useBoardingPassUpload(t);
  const view = useBoardingPassView();
  const rejection = flight.boardingPassRejection;
  // A rejected photo no longer counts as sent: the candidate is asked for a new one.
  const uploadedAt = rejection ? null : flight.boardingPassUploadedAt;
  const rowDirection = rowDirectionTowards(language === 'ur' ? 'right' : 'left');
  const uploadWindow = flight.boardingPassUpload;
  const windowState = uploadWindow?.state ?? 'open';

  if (windowState === 'not_yet_open' && uploadWindow) {
    return (
      <View style={styles.box} accessibilityLabel={t('boardingPassTitle')}>
        <Text style={[styles.title, statusCopyStyle(language, 13)]}>{t('boardingPassTitle')}</Text>
        <View style={[styles.row, { flexDirection: rowDirection }]}>
          <CalendarClock size={16} color={themed('#0065B3', '#93C5FD')} />
          <Text style={[styles.notice, styles.flex, statusCopyStyle(language, 14)]}>
            {interpolate(t('boardingPassOpensOn'), { date: calendarDay(uploadWindow.opensOn, language) })}
          </Text>
        </View>
        <View style={[styles.actions, { flexDirection: rowDirection }]}>
          <Button variant="primary" size="sm" style={styles.flex} language={language} disabled onPress={upload.takePhoto}
            leadingIcon={<Camera size={16} color={colors.brand.on} />}>
            {t('profilePhotoTake')}
          </Button>
          <Button variant="outline" size="sm" style={styles.flex} language={language} disabled onPress={upload.chooseFromGallery}
            leadingIcon={<ImageIcon size={16} color={colors.text.primary} />}>
            {t('boardingPassChooseFile')}
          </Button>
        </View>
      </View>
    );
  }

  if (windowState === 'closed') {
    return (
      <View style={styles.box} accessibilityLabel={t('boardingPassTitle')}>
        <Text style={[styles.title, statusCopyStyle(language, 13)]}>{t('boardingPassTitle')}</Text>
        {rejection ? <RejectionNotice reason={rejection.reason} language={language} t={t} /> : null}
        {uploadedAt ? (
          <View style={[styles.row, { flexDirection: rowDirection }]}>
            <CheckCircle2 size={16} color={themed('#087443', '#83F6C2')} />
            <Text style={[styles.uploaded, styles.flex, statusCopyStyle(language, 14)]}>
              {interpolate(t('boardingPassUploadedOn'), { date: uploadedOn(uploadedAt, language) })}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.hint, statusCopyStyle(language, 13)]}>
          {t(rejection ? 'boardingPassRejectedClosed' : uploadedAt ? 'boardingPassClosedUploaded' : 'boardingPassClosedMissing')}
        </Text>
        {uploadedAt ? (
          <View style={[styles.actions, { flexDirection: rowDirection }]}>
            <Button variant="outline" size="sm" style={styles.flex} language={language} onPress={view.viewBoardingPass}
              disabled={view.isRequesting} leadingIcon={<Eye size={16} color={colors.text.primary} />}>
              {t('boardingPassView')}
            </Button>
          </View>
        ) : null}
        {view.error ? (
          <ValidationMessage tone="error" language={language}>
            {t('boardingPassViewFailed')}
          </ValidationMessage>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.box} accessibilityLabel={t('boardingPassTitle')}>
      <Text style={[styles.title, statusCopyStyle(language, 13)]}>{t('boardingPassTitle')}</Text>
      {rejection ? <RejectionNotice reason={rejection.reason} language={language} t={t} /> : null}
      {uploadedAt ? (
        <View style={[styles.row, { flexDirection: rowDirection }]}>
          <CheckCircle2 size={16} color={themed('#087443', '#83F6C2')} />
          <Text style={[styles.uploaded, styles.flex, statusCopyStyle(language, 14)]}>
            {interpolate(t('boardingPassUploadedOn'), { date: uploadedOn(uploadedAt, language) })}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.hint, statusCopyStyle(language, 13)]}>
        {t(rejection ? 'boardingPassRejectedHint' : uploadedAt ? 'boardingPassReplaceHint' : 'boardingPassHint')}
      </Text>
      <View style={[styles.actions, { flexDirection: rowDirection }]}>
        <Button
          variant={uploadedAt ? 'outline' : 'primary'}
          size="sm"
          style={styles.flex}
          language={language}
          onPress={upload.takePhoto}
          disabled={upload.isUploading}
          leadingIcon={<Camera size={16} color={uploadedAt ? colors.text.primary : colors.brand.on} />}
        >
          {t('profilePhotoTake')}
        </Button>
        {/* Once uploaded, the second action lets them check what they sent;
            a wrong photo is replaced with a new camera photo. */}
        {uploadedAt ? (
          <Button
            variant="outline"
            size="sm"
            style={styles.flex}
            language={language}
            onPress={view.viewBoardingPass}
            disabled={upload.isUploading || view.isRequesting}
            leadingIcon={<Eye size={16} color={colors.text.primary} />}
          >
            {t('boardingPassView')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            style={styles.flex}
            language={language}
            onPress={upload.chooseFromGallery}
            disabled={upload.isUploading}
            leadingIcon={<ImageIcon size={16} color={colors.text.primary} />}
          >
            {t('boardingPassChooseFile')}
          </Button>
        )}
      </View>
      {upload.isUploading ? (
        <Text style={[styles.hint, statusCopyStyle(language, 13)]}>{t('boardingPassUploading')}</Text>
      ) : null}
      {view.error ? (
        <ValidationMessage tone="error" language={language}>
          {t('boardingPassViewFailed')}
        </ValidationMessage>
      ) : null}
      {upload.problem ? (
        <ValidationMessage tone="error" language={language}>
          {problemMessage(upload.problem, t)}
        </ValidationMessage>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  box: {
    marginTop: spacing[2],
    borderRadius: 10,
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: themed('#EEF6FF', '#172554'),
    borderWidth: 1,
    borderColor: themed('#CFE3FA', '#1E3A8A'),
  },
  title: { fontSize: 13, color: themed('#0065B3', '#93C5FD') },
  row: { gap: spacing[2], alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  uploaded: { fontSize: 14, color: themed('#087443', '#83F6C2') },
  hint: { fontSize: 13, color: themed('#526581', '#A9BFE5') },
  notice: { fontSize: 14, color: themed('#0065B3', '#93C5FD') },
  actions: { gap: spacing[2] },
  rejection: {
    borderRadius: 8,
    padding: spacing[2],
    gap: spacing[1],
    backgroundColor: themed('#FEF3F2', '#3B1212'),
    borderWidth: 1,
    borderColor: themed('#FECDCA', '#7A271A'),
  },
  rejectedTitle: { fontSize: 14, color: themed('#B42318', '#FDA29B') },
  rejectedReason: { fontSize: 13, color: themed('#7A271A', '#FECDCA') },
}));
