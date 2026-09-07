import { supportsOcrExtraction } from './ocrSupportedRequirementCodes';

describe('supportsOcrExtraction', () => {
  it('is true for passport, cnic_front, cnic_back and next_of_kin_cnic', () => {
    expect(supportsOcrExtraction('passport')).toBe(true);
    expect(supportsOcrExtraction('cnic_front')).toBe(true);
    expect(supportsOcrExtraction('cnic_back')).toBe(true);
    expect(supportsOcrExtraction('next_of_kin_cnic')).toBe(true);
  });

  it('is false for every other requirement code, including police_character', () => {
    expect(supportsOcrExtraction('police_character')).toBe(false);
    expect(supportsOcrExtraction('cv')).toBe(false);
  });
});
