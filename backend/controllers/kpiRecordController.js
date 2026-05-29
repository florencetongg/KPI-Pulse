const mongoose = require('mongoose');
const Kpi = require('../models/kpi');
const KpiRecord = require('../models/kpiRecord');
const { NOT_DELETED, isActiveKpi } = require('../utils/kpiQuery');
const { loadMergedHistoryForKpi, loadMergedManagerHistory } = require('../utils/mergedHistory');

function buildKpiMetaFromContext(kpi, entries) {
    if (isActiveKpi(kpi)) {
        const staff = kpi.assignedTo && typeof kpi.assignedTo === 'object' ? kpi.assignedTo : null;
        return {
            id: kpi._id,
            name: kpi.name,
            assignedToName: staff?.name || kpi.assignedToName || '—',
            department: staff?.department || '—',
            target: `${kpi.target} ${kpi.unit}`,
            currentProgress: Number(kpi.progress) || 0,
        };
    }

    const latest = entries[entries.length - 1] || entries[0];
    if (!latest) return null;

    return {
        id: latest.kpi_id,
        name: latest.name || latest.kpiName || 'Untitled KPI',
        assignedToName: latest.staffName || '—',
        department: latest.department || '—',
        target: latest.target || '—',
        currentProgress: Number(latest.progress) || 0,
    };
}

function managerHasHistoryAccess(entries, managerId) {
    const managerKey = String(managerId);
    return entries.some((entry) => {
        const actorId = entry.actorId && typeof entry.actorId === 'object'
            ? String(entry.actorId._id || entry.actorId)
            : String(entry.actorId || '');
        const managerRef = String(entry.managerId || '');

        return managerRef === managerKey
            || (actorId === managerKey && entry.actorRole === 'manager');
    });
}

async function resolveKpiHistoryContext(kpiId, managerId) {
    if (!mongoose.Types.ObjectId.isValid(kpiId)) {
        return { error: { status: 400, message: 'Invalid KPI id.' } };
    }

    const entries = await loadMergedHistoryForKpi(kpiId);
    if (!entries.length) {
        return { error: { status: 404, message: 'No history found for this KPI.' } };
    }

    const hasHistoryAccess = managerHasHistoryAccess(entries, managerId);
    if (!hasHistoryAccess) {
        const kpi = await Kpi.findById(kpiId).select('createdBy isDeleted assignedToName').lean();
        const ownsKpi = isActiveKpi(kpi) && String(kpi.createdBy) === String(managerId);
        if (!ownsKpi) {
            return { error: { status: 403, message: 'You cannot view cycle history for this KPI.' } };
        }
    }

    const kpi = await Kpi.findById(kpiId)
        .populate('assignedTo', 'name department')
        .lean();

    return {
        kpi: buildKpiMetaFromContext(kpi, entries),
        entries,
    };
}

exports.getManagerKpiRecordsFeed = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Only managers can view completed KPI cycles.' });
        }

        const history = await loadMergedManagerHistory(req.user._id);
        const approvedOnly = history.filter((entry) => entry.action === 'approved');

        res.json({ success: true, data: approvedOnly });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getKpiHistoryFeed = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Only managers can view KPI history feed.' });
        }

        const history = await loadMergedManagerHistory(req.user._id);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getKpiHistoryByKpiId = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Only managers can view KPI history.' });
        }

        const kpiId = req.query.kpi_id;
        if (!kpiId) {
            return res.status(400).json({ success: false, message: 'kpi_id query parameter is required.' });
        }

        const { entries, error } = await resolveKpiHistoryContext(kpiId, req.user._id);
        if (error) {
            return res.status(error.status).json({ success: false, message: error.message });
        }

        res.json({ success: true, data: entries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getKpiHistoryCycles = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Only managers can view KPI cycle history.' });
        }

        const { kpi, entries, error } = await resolveKpiHistoryContext(req.params.kpiId, req.user._id);
        if (error) {
            return res.status(error.status).json({ success: false, message: error.message });
        }

        res.json({
            success: true,
            data: {
                kpi,
                cycles: entries,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getKpiRecordsByKpiId = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Only managers can view KPI cycle records.' });
        }

        const kpi = await Kpi.findOne({ _id: req.params.kpiId, ...NOT_DELETED });
        if (!kpi) {
            return res.status(404).json({ success: false, message: 'KPI not found.' });
        }
        if (kpi.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You can only view cycle history for KPIs you created.' });
        }

        const records = await KpiRecord.find({
            kpiId: req.params.kpiId,
            managerId: req.user._id,
        })
            .sort({ cycleLabel: 1 })
            .lean();

        res.json({ success: true, data: records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
