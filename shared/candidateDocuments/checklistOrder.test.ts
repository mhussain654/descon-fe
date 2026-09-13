import { sortByPrototypeOrder, splitAroundCnicCluster } from './checklistOrder';

function item(requirementCode: string) {
  return { requirementCode };
}

describe('sortByPrototypeOrder', () => {
  it('reorders a backend response (alphabetical by requirement code) into the approved prototype order', () => {
    const checklist = [
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

describe('splitAroundCnicCluster', () => {
  it('separates passport/CNIC/next-of-kin-CNIC from every other requirement, preserving order', () => {
    const checklist = sortByPrototypeOrder([
      item('polio_certificate'),
      item('cnic_back'),
      item('cv'),
      item('passport'),
      item('cnic_front'),
      item('police_character'),
      item('next_of_kin_cnic'),
    ]);

    const { cnicClusterItems, remainingItems } = splitAroundCnicCluster(checklist);

    expect(cnicClusterItems.map((i) => i.requirementCode)).toEqual([
      'passport',
      'cnic_front',
      'cnic_back',
      'next_of_kin_cnic',
    ]);
    expect(remainingItems.map((i) => i.requirementCode)).toEqual(['police_character', 'cv', 'polio_certificate']);
  });

  it('puts a requirement code the prototype never modeled into the remaining group, not the CNIC cluster', () => {
    const checklist = [item('passport'), item('some_future_requirement')];

    const { cnicClusterItems, remainingItems } = splitAroundCnicCluster(checklist);

    expect(cnicClusterItems.map((i) => i.requirementCode)).toEqual(['passport']);
    expect(remainingItems.map((i) => i.requirementCode)).toEqual(['some_future_requirement']);
  });

  it('returns empty arrays for an empty checklist', () => {
    expect(splitAroundCnicCluster([])).toEqual({ cnicClusterItems: [], remainingItems: [] });
  });
});
