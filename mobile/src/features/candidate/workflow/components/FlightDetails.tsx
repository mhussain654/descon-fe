import { View } from 'react-native';
import { Clock, Plane } from 'lucide-react-native';
import { Text } from '../../../../design-system/Text';
import { spacing } from '../../../../design-system/tokens';
import { themed, themedStyles } from '../../../../design-system/theme';
import { rowDirectionTowards } from '../../../../lib/layoutDirection';
import type { CandidateFlightDetail } from '../../../../../../shared/candidateFlightDetail/types';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { statusCopyStyle } from '../../progress/components/StatusPresentation';

interface FlightDetailsProps {
  flight: CandidateFlightDetail;
  language: Language;
  t: (key: TranslationKey) => string;
}

/** "20/11/2026 • 14:30" in the phone's own time zone (Pakistan for candidates still at home). */
function departureLabel(iso: string, language: Language): string | null {
  const departure = new Date(iso);
  if (Number.isNaN(departure.getTime())) return null;
  const locale = language === 'ur' ? 'ur-PK' : 'en-GB';
  const date = departure.toLocaleDateString(locale);
  const time = departure.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} • ${time}`;
}

/**
 * The candidate's flight as staff recorded it -- airline, flight number,
 * route and departure -- shown on the Status tab's Ready to Fly step and on
 * Home while the flight is coming up, matching the SMS that asks them to check
 * MPS Connect for their flight details. Same look as MedicalAppointmentDetails.
 * Only what was recorded is shown: a blank field leaves no empty line or label.
 */
export function FlightDetails({ flight, language, t }: FlightDetailsProps) {
  const departure = flight.flightDepartureAt ? departureLabel(flight.flightDepartureAt, language) : null;
  const flightName = [flight.airline, flight.flightNumber].map((part) => part?.trim()).filter(Boolean).join(' ');
  const route = flight.sector?.trim() || null;
  if (!flightName && !route && !departure) return null;
  const iconColor = themed('#0065B3', '#7CC4FF');
  const rowStyle = [styles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }];

  return (
    <View style={styles.box} accessibilityLabel={t('candidateFlightDetailsTitle')}>
      <Text style={[styles.title, statusCopyStyle(language, 13)]}>{t('candidateFlightDetailsTitle')}</Text>
      {flightName || route ? (
        <View style={rowStyle}>
          <Plane size={14} color={iconColor} style={styles.icon} />
          <View style={styles.flex}>
            {flightName ? <Text style={[styles.primary, statusCopyStyle(language, 14)]}>{flightName}</Text> : null}
            {route ? <Text style={[styles.secondary, statusCopyStyle(language, 13)]}>{route}</Text> : null}
          </View>
        </View>
      ) : null}
      {departure ? (
        <View style={rowStyle}>
          <Clock size={14} color={iconColor} style={styles.icon} />
          <Text style={[styles.primary, styles.flex, statusCopyStyle(language, 14)]}>
            {`${t('candidateFlightDetailsDepartureLabel')}: ${departure}`}
          </Text>
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
