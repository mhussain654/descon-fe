import { isCameraCaptureEligible } from './captureEligibility';

describe('isCameraCaptureEligible', () => {
  it('is not eligible for a CV/resume', () => {
    expect(isCameraCaptureEligible('cv')).toBe(false);
  });

  it('is not eligible for an experience letter', () => {
    expect(isCameraCaptureEligible('experience_letter')).toBe(false);
  });

  it('is not eligible for certificates', () => {
    expect(isCameraCaptureEligible('certificates')).toBe(false);
  });

  it('is eligible for a passport', () => {
    expect(isCameraCaptureEligible('passport')).toBe(true);
  });

  it('is eligible for a CNIC front/back', () => {
    expect(isCameraCaptureEligible('cnic_front')).toBe(true);
    expect(isCameraCaptureEligible('cnic_back')).toBe(true);
  });

  it('is eligible for the police character certificate', () => {
    expect(isCameraCaptureEligible('police_character')).toBe(true);
  });

  it('is eligible for bank details and the cancelled cheque image', () => {
    expect(isCameraCaptureEligible('bank_details')).toBe(true);
    expect(isCameraCaptureEligible('cheque_image')).toBe(true);
  });

  it('is eligible for the polio certificate', () => {
    expect(isCameraCaptureEligible('polio_certificate')).toBe(true);
  });

  it('is eligible for an unrecognized requirement code, defaulting to allowing capture', () => {
    expect(isCameraCaptureEligible('some_future_requirement')).toBe(true);
  });
});
