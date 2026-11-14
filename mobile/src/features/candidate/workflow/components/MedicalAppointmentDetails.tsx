import { View } from 'react-native';
import { Clock, MapPin } from 'lucide-react-native';
import { Text } from '../../../../design-system/Text';
import { spacing } from '../../../../design-system/tokens';
import { themed, themedStyles } from '../../../../design-system/theme';
import { rowDirectionTowards } from '../../../../lib/layoutDirection';
import type { MedicalAppointment } from '../../../../../../shared/candidateWorkflow/medicalAppointment';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { statusCopyStyle } from '../../progress/components/StatusPresentation';

interface MedicalAppointmentDetailsProps {
  appointment: MedicalAppointment;
  language: Language;
  t: (key: TranslationKey) => string;
  /** The box heading; the QVC appointment reuses this box with its own title. */
  titleKey?: TranslationKey;
}

/** "20/11/2026 • 09:30", or whichever of the two was recorded. */
function whenLabel(appointment: MedicalAppointment, language: Language): string | null {
  const date = appointment.date
    ? new Date(`${appointment.date}T00:00:00`).toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB')
    : null;
  const parts = [date, appointment.time ?? null].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' • ') : null;
}

/**
 * Where and when the candidate goes for their medical, as staff recorded it
 * when moving them to the medical appointment stage -- shown under the Medical
 * step on the Status tab. Only what was recorded is shown. Also used for the
 * QVC appointment (Qatar), which has the same centre, address, date and time.
 */
export function MedicalAppointmentDetails({
  appointment,
  language,
  t,
  titleKey = 'candidateMedicalAppointmentTitle',
}: MedicalAppointmentDetailsProps) {
  const when = whenLabel(appointment, language);
  const iconColor = themed('#0065B3', '#7CC4FF');
  const rowStyle = [styles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }];

  return (
    <View style={styles.box} accessibilityLabel={t(titleKey)}>
      <Text style={[styles.title, statusCopyStyle(language, 13)]}>{t(titleKey)}</Text>
      {appointment.centerName || appointment.centerAddress ? (
        <View style={rowStyle}>
          <MapPin size={14} color={iconColor} style={styles.icon} />
          <View style={styles.flex}>
            {appointment.centerName ? (
              <Text style={[styles.primary, statusCopyStyle(language, 14)]}>{appointment.centerName}</Text>
            ) : null}
            {appointment.centerAddress ? (
              <Text style={[styles.secondary, statusCopyStyle(language, 13)]}>{appointment.centerAddress}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {when ? (
        <View style={rowStyle}>
          <Clock size={14} color={iconColor} style={styles.icon} />
          <Text style={[styles.primary, styles.flex, statusCopyStyle(language, 14)]}>{when}</Text>
        </View>
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
  row: { gap: spacing[2], alignItems: 'flex-start' },
  icon: { marginTop: 3 },
  flex: { flex: 1, minWidth: 0 },
  primary: { fontSize: 14, color: themed('#172B4D', '#E2E8F0') },
  secondary: { fontSize: 13, color: themed('#526581', '#A9BFE5'), marginTop: 2 },
}));
