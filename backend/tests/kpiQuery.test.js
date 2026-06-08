const { isActiveKpi } = require('../utils/kpiQuery');

describe('isActiveKpi (UT-05 to UT-07)', () => {
  test('UT-05: active when isDeleted is false or missing', () => {
    expect(isActiveKpi({ isDeleted: false })).toBe(true);
    expect(isActiveKpi({})).toBe(true);
  });

  test('UT-06: inactive for null', () => {
    expect(isActiveKpi(null)).toBe(false);
  });

  test('UT-07: inactive when isDeleted is true', () => {
    expect(isActiveKpi({ isDeleted: true })).toBe(false);
  });
});
