const Kpi = require('../models/kpi');
const KpiHistory = require('../models/kpiHistory');
const KpiRecord = require('../models/kpiRecord');
const Evidence = require('../models/evidence');
const User = require('../models/user');
const mongoose = require('mongoose');
const { getMergedManagerHistoryKpiIds } = require('../utils/mergedHistory');

const NOT_DELETED = { isDeleted: { $ne: true } };

const ALLOWED_EVIDENCE_MIME_TYPES = [
    '',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;

const createHistory = (kpi, req, action, overrides = {}) => KpiHistory.create({
    kpi_id: kpi._id,
    staffId: kpi.assignedTo,
    managerId: kpi.createdBy,
    actorId: req.user._id,
    actorRole: req.user.role,
    action,
    name: kpi.name,
    status: overrides.status || kpi.status,
    target: `${kpi.target} ${kpi.unit}`,
    value: overrides.value ?? kpi.currentValue ?? 0,
    progress: overrides.progress ?? kpi.progress ?? 0,
    evidenceName: overrides.evidenceName ?? kpi.evidenceName ?? '',
    evidenceMimeType: overrides.evidenceMimeType ?? kpi.evidenceMimeType ?? '',
    evidenceSize: overrides.evidenceSize ?? kpi.evidenceSize ?? 0,
    evidenceRef: overrides.evidenceRef ?? kpi.evidenceRef ?? null,
    rejectionReason: overrides.rejectionReason ?? kpi.rejectionReason ?? '',
    comment: overrides.comment ?? kpi.comments ?? '',
    submittedAt: overrides.submittedAt ?? null,
    deadline: overrides.deadline ?? null,
});

const validateRequired = (fields, body) => {
    const missing = fields.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
    return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null;
};

const validateEvidence = ({ evidenceRef = null, evidenceName = '', evidenceMimeType = '', evidenceSize = 0 }) => {
    if (evidenceRef) return null;
    if (!evidenceName && !evidenceMimeType && !evidenceSize) return null;
    return 'Evidence must be uploaded through the evidence endpoint and referenced by evidenceRef.';
};

const canManagerAccessKpi = (manager, kpi) => (
    kpi.createdBy.toString() === manager._id.toString()
);

const computeIsOverdue = (kpi) => {
    const deadline = kpi.deadline || kpi.dueDate;
    if (!deadline) return false;
    return new Date(deadline) < new Date() && ['pending', 'in-progress'].includes(kpi.status);
};

// Create KPI (Manager Only)
exports.createKpi = async (req, res) => {
    try {
        const { name, description, category, priority, weight, assignedTo, target, unit, dueDate } = req.body;
        const missingMessage = validateRequired(['name', 'description', 'category', 'assignedTo', 'target', 'unit', 'dueDate'], req.body);
        if (missingMessage) return res.status(400).json({ success: false, message: missingMessage });

        const staff = await User.findById(assignedTo).select('role department isActive');
        if (!staff || staff.role !== 'staff' || staff.isActive === false) {
            return res.status(400).json({ success: false, message: 'KPI can only be assigned to an active staff user.' });
        }
        if (req.user.department && staff.department && req.user.department !== staff.department) {
            return res.status(403).json({ success: false, message: 'Managers can only assign KPIs within their department.' });
        }
        
        const kpi = await Kpi.create({
            name, description, category, priority, weight, assignedTo, target, unit, dueDate,
            createdBy: req.user._id
        });

        await createHistory(kpi, req, 'created');

        res.status(201).json({ success: true, data: kpi });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Read KPIs (Scoped to Role context)
exports.getKpis = async (req, res) => {
    try {
        let query = { ...NOT_DELETED };

        if (req.user.role === 'staff') {
            query.assignedTo = req.user._id;
        } else if (req.user.role === 'manager') {
            const managerId = req.user._id;
            const historyKpiIds = await getMergedManagerHistoryKpiIds(managerId);

            const orConditions = [{ createdBy: managerId }];
            if (historyKpiIds.length) {
                orConditions.push({ _id: { $in: historyKpiIds } });
            }

            query.$or = orConditions;
        }

        const kpis = await Kpi.find(query)
            .populate('assignedTo', 'name email department')
            .populate('createdBy', 'name')
            .lean();
        const kpisWithOverdue = kpis.map(kpi => ({
            ...kpi,
            isOverdue: computeIsOverdue(kpi),
        }));
        res.json({ success: true, data: kpisWithOverdue });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getKpiById = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED })
            .populate('assignedTo', 'name email department')
            .populate('createdBy', 'name')
            .lean();

        if (!kpi) return res.status(404).json({ success: false, message: 'KPI not found' });

        const assignedToId = kpi.assignedTo?._id || kpi.assignedTo;
        const createdById = kpi.createdBy?._id || kpi.createdBy;
        const isAssignedStaff = req.user.role === 'staff' && String(assignedToId) === String(req.user._id);
        const isOwnerManager = req.user.role === 'manager' && String(createdById) === String(req.user._id);

        if (!isAssignedStaff && !isOwnerManager) {
            return res.status(403).json({ success: false, message: 'You cannot view this KPI.' });
        }

        res.json({ success: true, data: { ...kpi, isOverdue: computeIsOverdue(kpi) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Staff Updates Incremental Progress + Evidential Links
exports.submitProgress = async (req, res) => {
    try {
        const { currentValue, progress, status, evidenceRef, evidenceName, evidenceMimeType, evidenceSize, comments } = req.body;
        const evidenceMessage = validateEvidence({ evidenceRef, evidenceName, evidenceMimeType, evidenceSize });
        if (evidenceMessage) return res.status(400).json({ success: false, message: evidenceMessage });

        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED });

        if (!kpi) return res.status(404).json({ message: 'KPI record not found' });
        if (kpi.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized modification attempt' });
        }
        if (kpi.status === 'approved') {
            return res.status(409).json({ success: false, message: 'Approved KPIs cannot be resubmitted.' });
        }
        const progressValue = Number(progress);
        if (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100) {
            return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100.' });
        }
        const currentValueProvided = currentValue !== undefined && currentValue !== null && currentValue !== '';
        const currentValueNumber = currentValueProvided ? Number(currentValue) : kpi.currentValue;
        if (currentValueProvided && (!Number.isFinite(currentValueNumber) || currentValueNumber < 0)) {
            return res.status(400).json({ success: false, message: 'Current value must be a valid number.' });
        }

        const statusValue = ['pending', 'in-progress', 'submitted'].includes(status)
            ? status
            : (progressValue === 100 ? 'submitted' : progressValue > 0 ? 'in-progress' : 'pending');

        kpi.currentValue = currentValueNumber || 0;
        kpi.progress = progressValue;
        kpi.comments = comments;
        kpi.status = statusValue;
        kpi.submittedAt = statusValue === 'submitted' ? Date.now() : null;

        // Attach evidence by reference if provided (upload endpoint returns id)
        if (evidenceRef === null || evidenceRef === '' || evidenceRef === 'null') {
            kpi.evidenceRef = null;
            kpi.evidenceName = '';
            kpi.evidenceMimeType = '';
            kpi.evidenceSize = 0;
        } else if (evidenceRef) {
            const ev = await Evidence.findById(evidenceRef).select('_id name mimeType size kpi uploadedBy');
            if (!ev) return res.status(400).json({ success: false, message: 'Invalid evidence reference provided.' });
            kpi.evidenceRef = ev._id;
            kpi.evidenceName = ev.name || '';
            kpi.evidenceMimeType = ev.mimeType || '';
            kpi.evidenceSize = ev.size || 0;
            if (!ev.kpi) {
                ev.kpi = kpi._id;
                await ev.save();
            }
        }

        await kpi.save();

        // Write immutable transaction into History Logs collection
        await createHistory(kpi, req, statusValue === 'submitted' ? 'submitted' : 'updated', {
            status: statusValue,
            value: currentValueNumber || 0,
            progress: progressValue,
            comment: comments,
            evidenceName: kpi.evidenceName || '',
            evidenceMimeType: kpi.evidenceMimeType || '',
            evidenceSize: kpi.evidenceSize || 0,
            evidenceRef: kpi.evidenceRef || null
        });

        res.json({ success: true, message: 'Progress submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Manager Review Processing
exports.reviewKpi = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid review validation status' });
        }

        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED });
        if (!kpi) return res.status(404).json({ message: 'KPI not found' });
        if (!canManagerAccessKpi(req.user, kpi)) {
            return res.status(403).json({ success: false, message: 'You can only review KPIs you created.' });
        }
        if (kpi.status !== 'submitted') {
            return res.status(409).json({ success: false, message: 'Only submitted KPIs can be reviewed.' });
        }
        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        if (status === 'approved') {
            const staff = await User.findById(kpi.assignedTo).select('department');
            const department = staff?.department || req.user.department || '';
            const evidenceUrl = kpi.evidenceRef ? `/api/evidence/${kpi.evidenceRef}/download` : '';
            const reviewNote = String(req.body.reviewNote || '').trim();
            const reviewedAt = new Date();
            const approvalSnapshot = {
                currentValue: kpi.currentValue,
                progress: kpi.progress ?? 0,
                evidenceName: kpi.evidenceName || '',
                evidenceMimeType: kpi.evidenceMimeType || '',
                evidenceSize: kpi.evidenceSize || 0,
                evidenceRef: kpi.evidenceRef || null,
            };

            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const existingCount = await KpiRecord.countDocuments({ kpiId: kpi._id }).session(session);
                    const cycleLabel = `Cycle ${existingCount + 1}`;

                    await KpiRecord.create([{
                        kpiId: kpi._id,
                        kpiTitle: kpi.name,
                        managerId: req.user._id,
                        assignedTo: kpi.assignedTo,
                        department,
                        cycleLabel,
                        targetValue: kpi.target,
                        actualValue: kpi.currentValue,
                        evidenceUrl,
                        deadline: kpi.dueDate,
                        submittedAt: kpi.submittedAt,
                        reviewedAt,
                        status: 'approved',
                        reviewNote,
                    }], { session });

                    await Kpi.updateOne(
                        { _id: kpi._id },
                        {
                            $set: {
                                status: 'pending',
                                progress: 0,
                                currentValue: 0,
                                evidenceRef: null,
                                evidenceName: '',
                                evidenceMimeType: '',
                                evidenceSize: 0,
                                submittedAt: null,
                                comments: '',
                                rejectionReason: '',
                            },
                        },
                        { session }
                    );
                });
            } finally {
                session.endSession();
            }

            await createHistory(kpi, req, 'approved', {
                status: 'approved',
                progress: approvalSnapshot.progress,
                value: approvalSnapshot.currentValue,
                comment: reviewNote,
                evidenceName: approvalSnapshot.evidenceName,
                evidenceMimeType: approvalSnapshot.evidenceMimeType,
                evidenceSize: approvalSnapshot.evidenceSize,
                evidenceRef: approvalSnapshot.evidenceRef,
                submittedAt: kpi.submittedAt,
                deadline: kpi.dueDate,
            });

            const updatedKpi = await Kpi.findById(kpi._id);
            return res.json({ success: true, data: updatedKpi });
        }

        kpi.status = status;
        kpi.rejectionReason = rejectionReason;
        await kpi.save();

        await createHistory(kpi, req, status, { rejectionReason });

        res.json({ success: true, data: kpi });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateKpi = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED });
        if (!kpi) return res.status(404).json({ success: false, message: 'KPI not found' });
        if (!canManagerAccessKpi(req.user, kpi)) {
            return res.status(403).json({ success: false, message: 'You can only update KPIs you created.' });
        }

        const allowedFields = ['name', 'description', 'category', 'priority', 'weight', 'assignedTo', 'target', 'unit', 'dueDate', 'status'];
        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        if (updates.assignedTo) {
            const staff = await User.findById(updates.assignedTo).select('role department isActive');
            if (!staff || staff.role !== 'staff' || staff.isActive === false) {
                return res.status(400).json({ success: false, message: 'KPI can only be assigned to an active staff user.' });
            }
            if (req.user.department && staff.department && req.user.department !== staff.department) {
                return res.status(403).json({ success: false, message: 'Managers can only assign KPIs within their department.' });
            }
        }

        if (updates.status && !['pending', 'in-progress', 'submitted', 'approved', 'rejected'].includes(updates.status)) {
            return res.status(400).json({ success: false, message: 'Invalid KPI status.' });
        }

        Object.assign(kpi, updates);
        await kpi.save();
        await createHistory(kpi, req, 'updated');

        res.json({ success: true, data: kpi });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getKpiHistory = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED });
        if (!kpi) return res.status(404).json({ success: false, message: 'KPI not found' });

        const isAssignedStaff = kpi.assignedTo.toString() === req.user._id.toString();
        const isOwnerManager = req.user.role === 'manager' && canManagerAccessKpi(req.user, kpi);
        if (!isAssignedStaff && !isOwnerManager) {
            return res.status(403).json({ success: false, message: 'You cannot view this KPI history.' });
        }

        const history = await KpiHistory.find({ kpi_id: kpi._id })
            .populate('actorId', 'name role department')
            .populate('staffId', 'name email department')
            .sort({ recordedAt: -1 });

        res.json({
            success: true,
            data: history.map(entry => ({
                ...entry.toObject(),
                kpiId: entry.kpi_id,
                staffName: entry.staffId?.name || '',
                timestamp: entry.recordedAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getManagerHistoryFeed = async (req, res) => {
    try {
        let kpiQuery = { ...NOT_DELETED };
        if (req.user.role === 'staff') {
            kpiQuery.assignedTo = req.user._id;
        } else if (req.user.role === 'manager') {
            kpiQuery.createdBy = req.user._id;
        }

        const kpiIds = await Kpi.find(kpiQuery).distinct('_id');
        if (!kpiIds.length) {
            return res.json({ success: true, data: [] });
        }

        const history = await KpiHistory.find({ kpi_id: { $in: kpiIds } })
            .populate('staffId', 'name email department')
            .populate('actorId', 'name role department')
            .sort({ recordedAt: -1 })
            .limit(500)
            .lean();

        res.json({
            success: true,
            data: history.map(entry => ({
                ...entry,
                kpiId: entry.kpi_id,
                staffName: entry.staffId?.name || '',
                timestamp: entry.recordedAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Soft Delete Implementation instead of permanent drops
exports.deleteKpi = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, ...NOT_DELETED });
        if (!kpi) return res.status(404).json({ message: 'KPI record not found' });
        if (!canManagerAccessKpi(req.user, kpi)) {
            return res.status(403).json({ success: false, message: 'You can only archive KPIs you created.' });
        }

        kpi.isDeleted = true;
        kpi.deletedAt = Date.now();
        kpi.deletedBy = req.user._id;
        await kpi.save();

        await createHistory(kpi, req, 'soft-deleted', { status: 'deleted' });

        res.json({ success: true, message: 'KPI record archived successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
