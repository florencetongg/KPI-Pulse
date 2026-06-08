const { calculateWeightedProgress } = require('../../js/kpi-weighted-progress');

describe('calculateWeightedProgress (UT-01 to UT-04)', () => {
  test('UT-01: weighted average of two KPIs', () => {
    const kpis = [
      { progress: 80, weight: 60 },
      { progress: 40, weight: 40 },
    ];
    expect(calculateWeightedProgress(kpis)).toBe(64);
  });

  test('UT-02: single KPI with full weight', () => {
    expect(calculateWeightedProgress([{ progress: 50, weight: 100 }])).toBe(50);
  });

  test('UT-03: all zero weights falls back to simple average', () => {
    const kpis = [
      { progress: 80, weight: 0 },
      { progress: 40, weight: 0 },
    ];
    expect(calculateWeightedProgress(kpis)).toBe(60);
  });

  test('UT-04: empty KPI array returns 0', () => {
    expect(calculateWeightedProgress([])).toBe(0);
  });
});
