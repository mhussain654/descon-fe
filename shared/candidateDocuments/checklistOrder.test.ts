import { sortByPrototypeOrder } from './checklistOrder';

function item(requirementCode: string) {
  return { requirementCode };
}

describe('sortByPrototypeOrder', () => {
  it('reorders a backend response (alphabetical by requirement code) into the approved prototype order', () => {
    const checklist = [
      item('bank_details'),
      item('cheque_image'),
      item('cnic_back'),
      item('cnic_front'),
      item('cv'),
      item('next_of_kin_cnic'),
      item('passport'),
      item('police_character_certificate'),
    ];

    expect(sortByPrototypeOrder(checklist).map((i) => i.requirementCode)).toEqual([
      'passport',
      'cnic_front',
      'cnic_back',
      'next_of_kin_cnic',
      'police_character_certificate',
      'bank_details',
      'cheque_image',
      'cv',
    ]);
  });

  it('places requirement codes the prototype never modeled after every known one, without dropping them', () => {
    const checklist = [item('passport'), item('some_future_requirement'), item('cnic_front')];

    expect(sortByPrototypeOrder(checklist).map((i) => i.requirementCode)).toEqual([
      'passport',
      'cnic_front',
      'some_future_requirement',
    ]);
  });

  it('does not mutate the input array', () => {
    const checklist = [item('cnic_front'), item('passport')];
    const original = [...checklist];

    sortByPrototypeOrder(checklist);

    expect(checklist).toEqual(original);
  });
});
