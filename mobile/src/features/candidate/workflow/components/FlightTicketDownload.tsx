import { View } from 'react-native';
import { Download } from 'lucide-react-native';
import { Button, ValidationMessage } from '../../../../design-system';
import { themed } from '../../../../design-system/theme';
import { isStartSide } from '../../../../lib/layoutDirection';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS } from '../../../../../../shared/candidateFlightDetail/errorMessages';
import { statusStyles } from '../../progress/components/StatusPresentation';
import type { useFlightTicketAccess } from '../hooks/useFlightTicketAccess';

interface FlightTicketDownloadProps {
  ticketAccess: ReturnType<typeof useFlightTicketAccess>;
  language: Language;
  t: (key: TranslationKey) => string;
}

/** The "Download Ticket" button and its error, shown on Status and Home once staff attached the ticket. */
export function FlightTicketDownload({ ticketAccess, language, t }: FlightTicketDownloadProps) {
  const alignSelf = isStartSide(language === 'ur' ? 'right' : 'left') ? 'flex-start' : 'flex-end';

  return (
    <View style={{ marginTop: 8 }}>
      <Button
        variant="outline"
        size="sm"
        style={[statusStyles.download, { alignSelf }]}
        labelStyle={[statusStyles.downloadText, language === 'ur' && statusStyles.downloadTextUrdu]}
        leadingIcon={<Download size={14} color={themed('#087443', '#83F6C2')} />}
        onPress={ticketAccess.downloadTicket}
        disabled={ticketAccess.isRequesting}
        language={language}
      >
        {t('candidateFlightDownloadTicketAction')}
      </Button>
      {ticketAccess.error ? (
        <View style={{ marginTop: 4 }}>
          <ValidationMessage tone="error" language={language}>
            {ticketAccess.error.message || t(CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS[ticketAccess.error.code] as TranslationKey)}
          </ValidationMessage>
        </View>
      ) : null}
    </View>
  );
}
