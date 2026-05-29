const mongoose = require('mongoose');
const { buildKpiIdMatch } = require('./kpiQuery');
const { enrichSingleKpiHistory, enrichHistoryEntries } = require('./kpiHistoryProgress');

const COLLECTIONS = {
    cycle: 'kpihistory',
    audit: 'kpiHistory',
};

function normalizeRawHistoryDoc(doc) {
    const staff = doc.staffId && typeof doc.staffId === 'object' ? doc.staffId : null;

    return {
        ...doc,
        name: doc.name || doc.kpiName || 'Untitled KPI',
        kpiName: doc.kpiName || doc.name || '',
        staffName: doc.staffName || staff?.name || '',
        comment: doc.comment || '',
        action: doc.action || 'approved',
        progress: Number(doc.progress) || 0,
        recordedAt: doc.recordedAt || doc.createdAt || new Date(),
    };
}

function dedupeHistoryDocs(docs) {
    const seen = new Map();
    docs.forEach((doc) => {
        const id = String(doc._id || `${doc.kpi_id}-${doc.action}-${doc.recordedAt}`);
        if (!seen.has(id)) seen.set(id, doc);
    });
    return [...seen.values()];
}

async function fetchFromCollection(collectionName, filter, sort = { recordedAt: 1 }) {
    try {
        return await mongoose.connection.collection(collectionName)
            .find(filter)
            .sort(sort)
            .toArray();
    } catch (error) {
        return [];
    }
}

async function loadMergedHistoryForKpi(kpiId) {
    const filter = buildKpiIdMatch(kpiId);
    const [cycleDocs, auditDocs] = await Promise.all([
        fetchFromCollection(COLLECTIONS.cycle, filter, { recordedAt: 1 }),
        fetchFromCollection(COLLECTIONS.audit, filter, { recordedAt: 1 }),
    ]);

    const merged = dedupeHistoryDocs([
        ...auditDocs.map(normalizeRawHistoryDoc),
        ...cycleDocs.map(normalizeRawHistoryDoc),
    ]).sort(
        (a, b) => new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime()
    );

    return enrichSingleKpiHistory(merged);
}

async function getMergedManagerHistoryKpiIds(managerId) {
    const managerObjectId = new mongoose.Types.ObjectId(managerId);
    const involvementFilter = {
        $or: [{ actorId: managerObjectId }, { managerId: managerObjectId }],
    };

    const [cycleIds, auditIds] = await Promise.all([
        fetchFromCollection(COLLECTIONS.cycle, involvementFilter).then((docs) =>
            [...new Set(docs.map((doc) => doc.kpi_id).filter(Boolean))]
        ),
        fetchFromCollection(COLLECTIONS.audit, involvementFilter).then((docs) =>
            [...new Set(docs.map((doc) => doc.kpi_id).filter(Boolean))]
        ),
    ]);

    const seen = new Set();
    return [...cycleIds, ...auditIds].filter((id) => {
        const key = String(id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function loadMergedManagerHistory(managerId) {
    const managerObjectId = new mongoose.Types.ObjectId(managerId);
    const involvementFilter = {
        $or: [{ actorId: managerObjectId }, { managerId: managerObjectId }],
    };

    const [cycleDocs, auditDocs] = await Promise.all([
        fetchFromCollection(COLLECTIONS.cycle, involvementFilter, { recordedAt: -1 }),
        fetchFromCollection(COLLECTIONS.audit, involvementFilter, { recordedAt: -1 }),
    ]);

    const merged = dedupeHistoryDocs([
        ...auditDocs.map(normalizeRawHistoryDoc),
        ...cycleDocs.map(normalizeRawHistoryDoc),
    ]);

    return enrichHistoryEntries(merged).map((entry) => ({
        ...entry,
        kpiId: entry.kpi_id,
        staffName: entry.staffName || entry.staffId?.name || '',
        timestamp: entry.recordedAt,
    }));
}

module.exports = {
    loadMergedHistoryForKpi,
    loadMergedManagerHistory,
    getMergedManagerHistoryKpiIds,
    normalizeRawHistoryDoc,
};
