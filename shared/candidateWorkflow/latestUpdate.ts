// The single most recent *actionable* workflow event, for the candidate
// home screen's "Latest update" card -- the same filtering as Status's
// "Recent updates" list (see actionableHistory.ts), so the two never
// disagree about what counts as an update.
import { isActionableHistoryItem } from './actionableHistory';
import type { WorkflowHistoryItem } from './types';

export function latestActionableUpdate(items: WorkflowHistoryItem[]): WorkflowHistoryItem | null {
  const actionable = items.filter(isActionableHistoryItem);
  if (actionable.length === 0) return null;
  return actionable.reduce((latest, item) =>
    new Date(item.occurredAt).getTime() > new Date(latest.occurredAt).getTime() ? item : latest
  );
}

/** A short candidate-facing sentence explaining what each stage transition means. Unknown/future codes fall back to a generic line. */
export const STAGE_UPDATE_DESCRIPTION_KEYS: Record<string, string> = {
  registered: 'homeUpdateRegistered',
  documents_pending: 'homeUpdateDocumentsPending',
  documents_uploaded: 'homeUpdateDocumentsUploaded',
  under_verification: 'homeUpdateUnderVerification',
  verified: 'homeUpdateVerified',
  fee_pending: 'homeUpdateFeePending',
  fee_paid: 'homeUpdateFeePaid',
  documents_shared_with_qatar_bu: 'homeUpdateDocumentsShared',
  qvc_appointment_booked: 'homeUpdateQvcBooked',
  qvc_completed_outcome_received: 'homeUpdateQvcOutcome',
  visa_issued_or_rejected: 'homeUpdateVisaDecision',
  appeared_for_protection: 'homeUpdateAppearedForProtection',
  protected_ready_to_fly: 'homeUpdateReadyToFly',
  flight_details_uploaded: 'homeUpdateFlightDetails',
  mobilized: 'homeUpdateMobilized',
};

export const STAGE_UPDATE_FALLBACK_KEY = 'homeUpdateGeneric';
