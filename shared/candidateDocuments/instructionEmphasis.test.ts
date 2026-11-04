import { instructionSegments } from './instructionEmphasis';

describe('instructionSegments', () => {
  it('emphasizes "Next of Kin" in the next of kin CNIC instructions', () => {
    const text = 'Only your father, or unmarried sister or daughter can be your Next of Kin. Choose how they are related.';

    expect(instructionSegments('next_of_kin_cnic', text)).toEqual([
      { text: 'Only your father, or unmarried sister or daughter can be your ', emphasized: false },
      { text: 'Next of Kin', emphasized: true },
      { text: '. Choose how they are related.', emphasized: false },
    ]);
  });

  it('emphasizes the Urdu term', () => {
    const text = 'صرف آپ کے والد آپ کے نیکسٹ آف کن ہو سکتے ہیں۔';

    expect(instructionSegments('next_of_kin_cnic', text)).toEqual([
      { text: 'صرف آپ کے والد آپ کے ', emphasized: false },
      { text: 'نیکسٹ آف کن', emphasized: true },
      { text: ' ہو سکتے ہیں۔', emphasized: false },
    ]);
  });

  it('leaves other requirements as one plain segment, even when they mention the term', () => {
    const text = 'Your Next of Kin is your wife, so scan your marriage certificate.';

    expect(instructionSegments('marriage_certificate', text)).toEqual([{ text, emphasized: false }]);
    expect(instructionSegments(null, text)).toEqual([{ text, emphasized: false }]);
  });

  it('returns the text unchanged when the term is absent', () => {
    expect(instructionSegments('next_of_kin_cnic', 'Scan both sides.')).toEqual([
      { text: 'Scan both sides.', emphasized: false },
    ]);
  });
});
