const { enrichSingleKpiHistory } = require('../utils/kpiHistoryProgress');

describe('enrichSingleKpiHistory (UT-08 to UT-09)', () => {
  test('UT-08: enriches submitted and approved entries', () => {
    const entries = [
      { action: 'submitted', progress: 75 },
      { action: 'approved', progress: 100 },
    ];

    const result = enrichSingleKpiHistory(entries);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      action: 'submitted',
      progress: 75,
      displayProgress: 75,
      submissionProgress: 75,
    });
    expect(result[1]).toMatchObject({
      action: 'approved',
      progress: 100,
      displayProgress: 75,
      submissionProgress: 75,
    });
  });

  test('UT-09: empty history returns empty array', () => {
    expect(enrichSingleKpiHistory([])).toEqual([]);
  });
});
