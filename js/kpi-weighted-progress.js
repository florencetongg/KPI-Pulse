function kpiProgressValue(kpi) {
  const progress = Number(kpi?.progress);
  return Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0;
}

function kpiWeightValue(kpi) {
  const weight = Number(kpi?.weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function calculateWeightedProgress(kpis) {
  if (!kpis.length) return 0;

  const totalWeight = kpis.reduce((sum, kpi) => sum + kpiWeightValue(kpi), 0);
  if (totalWeight > 0) {
    const weightedSum = kpis.reduce(
      (sum, kpi) => sum + kpiProgressValue(kpi) * kpiWeightValue(kpi),
      0
    );
    return Math.round(weightedSum / totalWeight);
  }

  const average = kpis.reduce((sum, kpi) => sum + kpiProgressValue(kpi), 0) / kpis.length;
  return Math.round(average);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    kpiProgressValue,
    kpiWeightValue,
    calculateWeightedProgress,
  };
}
