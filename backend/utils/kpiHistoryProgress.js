function resolveSubmissionProgress(entries, approvedIndex) {
    let lastApprovedBefore = -1;
    for (let i = approvedIndex - 1; i >= 0; i -= 1) {
        if (entries[i].action === 'approved') {
            lastApprovedBefore = i;
            break;
        }
    }

    const cycleSubmitted = entries
        .slice(lastApprovedBefore + 1, approvedIndex)
        .filter((entry) => entry.action === 'submitted');

    const lastSubmitted = cycleSubmitted[cycleSubmitted.length - 1];
    if (lastSubmitted) {
        return Number(lastSubmitted.progress) || 0;
    }

    return Number(entries[approvedIndex].progress) || 0;
}

function enrichSingleKpiHistory(entries) {
    const sorted = [...entries].sort(
        (a, b) => (new Date(a.recordedAt || 0).getTime()) - (new Date(b.recordedAt || 0).getTime())
    );

    return sorted.map((entry, index, all) => {
        const progress = Number(entry.progress) || 0;

        if (entry.action === 'approved') {
            const displayProgress = resolveSubmissionProgress(all, index);
            return {
                ...entry,
                displayProgress,
                submissionProgress: displayProgress,
            };
        }

        return {
            ...entry,
            displayProgress: progress,
            submissionProgress: entry.action === 'submitted' ? progress : null,
        };
    });
}

function enrichHistoryEntries(entries) {
    const byKpi = new Map();

    entries.forEach((entry) => {
        const kpiId = String(entry.kpi_id || entry.kpiId || '');
        if (!kpiId) return;
        if (!byKpi.has(kpiId)) byKpi.set(kpiId, []);
        byKpi.get(kpiId).push(entry);
    });

    const enriched = [];
    byKpi.forEach((kpiEntries) => {
        enriched.push(...enrichSingleKpiHistory(kpiEntries));
    });

    return enriched.sort(
        (a, b) => (new Date(b.recordedAt || 0).getTime()) - (new Date(a.recordedAt || 0).getTime())
    );
}

module.exports = {
    enrichHistoryEntries,
    enrichSingleKpiHistory,
    resolveSubmissionProgress,
};
