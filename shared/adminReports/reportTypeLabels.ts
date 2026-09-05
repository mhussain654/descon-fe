// Translation keys for each report type -- never render the raw report_type code.
import type { ReportType } from './types';

export const REPORT_TYPE_LABEL_KEYS: Record<ReportType, string> = {
  status_summary: 'reportTypeStatusSummary',
  mobilization: 'reportTypeMobilization',
  craft_summary: 'reportTypeCraftSummary',
  outcome_tracking: 'reportTypeOutcomeTracking',
  conversion: 'reportTypeConversion',
  trend: 'reportTypeTrend',
};
