import { findLatestMedicalAppointment } from './medicalAppointment';
import type { WorkflowHistoryItem } from './types';

function historyItem(overrides: Partial<WorkflowHistoryItem> = {}): WorkflowHistoryItem {
  return {
    fromStage: { code: 'campaign_nomination', name: 'Campaign Nomination', position: 6 },
    toStage: { code: 'medical_appointment', name: 'Medical Appointment', position: 7 },
    occurredAt: '2026-11-13T09:00:00Z',
    reasonCode: null,
    details: {
      medicalCenterName: 'Al Shifa Medical Centre',
      medicalCenterAddress: '12 Mall Road, Lahore',
      medicalAppointmentDate: '2026-11-20',
      medicalAppointmentTime: '09:30',
    },
    ...overrides,
  };
}

describe('findLatestMedicalAppointment', () => {
  it('reads the centre, address, date and time saved with the move into the medical appointment stage', () => {
    expect(findLatestMedicalAppointment([historyItem()])).toEqual({
      centerName: 'Al Shifa Medical Centre', centerAddress: '12 Mall Road, Lahore', date: '2026-11-20', time: '09:30',
    });
  });

  it('works for every country process, e.g. the GAMCA medical stage', () => {
    const gamca = historyItem({ toStage: { code: 'gamca_medical_pending', name: 'GAMCA Medical Pending', position: 7 } });

    expect(findLatestMedicalAppointment([gamca])?.centerName).toBe('Al Shifa Medical Centre');
  });

  it('is null when no move recorded any appointment detail, or there is no medical move at all', () => {
    expect(findLatestMedicalAppointment([historyItem({ details: null })])).toBeNull();
    expect(
      findLatestMedicalAppointment([historyItem({ toStage: { code: 'registered', name: 'Registered', position: 1 } })])
    ).toBeNull();
  });

  it('uses the latest move when the candidate was moved there more than once', () => {
    const items = [
      historyItem(),
      historyItem({ occurredAt: '2026-11-25T09:00:00Z', details: { medicalCenterName: 'New Centre', medicalAppointmentTime: '11:00' } }),
    ];

    expect(findLatestMedicalAppointment(items)).toEqual({ centerName: 'New Centre', time: '11:00' });
  });
});
