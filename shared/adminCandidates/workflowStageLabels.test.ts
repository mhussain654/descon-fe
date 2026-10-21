import {
  CANDIDATE_LIST_STAGE_LABEL_KEYS,
  ORDERED_WORKFLOW_STAGE_CODES,
  sortByWorkflowStageOrder,
  workflowStageLabelKey,
} from './workflowStageLabels';

describe('workflow stage labels', () => {
  it('lists every stage the backend defines, each exactly once and each with a label', () => {
    expect(ORDERED_WORKFLOW_STAGE_CODES).toHaveLength(30);
    expect(new Set(ORDERED_WORKFLOW_STAGE_CODES).size).toBe(30);
    const withoutLabel = ORDERED_WORKFLOW_STAGE_CODES.filter((code) => !CANDIDATE_LIST_STAGE_LABEL_KEYS[code]);
    expect(withoutLabel).toEqual([]);
    // The only label without a backend stage is the legacy one still used by older data.
    const extra = Object.keys(CANDIDATE_LIST_STAGE_LABEL_KEYS).filter((code) => !(ORDERED_WORKFLOW_STAGE_CODES as readonly string[]).includes(code));
    expect(extra).toEqual(['protected_ready_to_fly']);
  });

  it('keeps the journey order, from registration to mobilization', () => {
    expect(ORDERED_WORKFLOW_STAGE_CODES[0]).toBe('registered');
    expect(ORDERED_WORKFLOW_STAGE_CODES.at(-1)).toBe('mobilized');
    expect(ORDERED_WORKFLOW_STAGE_CODES.indexOf('medical_completed')).toBeLessThan(ORDERED_WORKFLOW_STAGE_CODES.indexOf('visa_issued_or_rejected'));
  });

  it('finds a label key for a known code and none for an unknown one', () => {
    expect(workflowStageLabelKey('medical_completed')).toBe('adminListStageMedicalCompleted');
    expect(workflowStageLabelKey('not_a_stage')).toBeUndefined();
  });

  it('sorts items into journey order, unknown codes last, without changing the input', () => {
    const input = [{ code: 'mobilized' }, { code: 'weird' }, { code: 'registered' }, { code: 'verified' }];

    const sorted = sortByWorkflowStageOrder(input, (item) => item.code);

    expect(sorted.map((item) => item.code)).toEqual(['registered', 'verified', 'mobilized', 'weird']);
    expect(input[0].code).toBe('mobilized');
  });
});
