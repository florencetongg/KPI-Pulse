const NOT_DELETED = { isDeleted: { $ne: true } };

function isActiveKpi(kpi) {
    if (!kpi) return false;
    return kpi.isDeleted !== true;
}

async function getManagerHistoryKpiIds(KpiHistory, managerId) {
    return KpiHistory.distinct('kpi_id', {
        $or: [{ actorId: managerId }, { managerId: managerId }],
    });
}

async function buildManagerKpiFilter(KpiHistory, managerId) {
    const historyKpiIds = await getManagerHistoryKpiIds(KpiHistory, managerId);
    const orConditions = [{ createdBy: managerId }];

    if (historyKpiIds.length) {
        orConditions.push({ _id: { $in: historyKpiIds } });
    }

    return {
        ...NOT_DELETED,
        $or: orConditions,
    };
}

function buildKpiIdMatch(kpiId) {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(kpiId)) {
        return { kpi_id: String(kpiId) };
    }

    const kpiObjectId = new mongoose.Types.ObjectId(kpiId);
    return {
        $or: [
            { kpi_id: kpiObjectId },
            { kpi_id: String(kpiId) },
        ],
    };
}

module.exports = {
    NOT_DELETED,
    isActiveKpi,
    getManagerHistoryKpiIds,
    buildManagerKpiFilter,
    buildKpiIdMatch,
};
