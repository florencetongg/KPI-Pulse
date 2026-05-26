const Kpi = require('../models/kpi');
const KpiHistory = require('../models/kpiHistory');
const Evidence = require('../models/evidence');
const User = require('../models/user');

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
    actorId: req.user._id,
    actorRole: req.user.role,
    action,
    name: kpi.name,
    status: overrides.status || kpi.status,
    target: `${kpi.target} ${kpi.unit}`,
    value: overrides.value ?? kpi.currentValue ?? 0,
    progress: overrides.progress ?? kpi.progress ?? 0,
    evidenceUrl: overrides.evidenceUrl ?? kpi.evidenceUrl ?? '',
    evidenceName: overrides.evidenceName ?? kpi.evidenceName ?? '',
    evidenceMimeType: overrides.evidenceMimeType ?? kpi.evidenceMimeType ?? '',
    evidenceSize: overrides.evidenceSize ?? kpi.evidenceSize ?? 0,
    evidenceRef: overrides.evidenceRef ?? kpi.evidenceRef ?? null,
    rejectionReason: overrides.rejectionReason ?? kpi.rejectionReason ?? '',
    comment: overrides.comment ?? kpi.comments ?? ''
});

const validateRequired = (fields, body) => {
    const missing = fields.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
    return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null;
};

const validateEvidence = ({ evidenceUrl = '', evidenceName = '', evidenceMimeType = '', evidenceSize = 0 }) => {
    if (!evidenceUrl && !evidenceName && !evidenceMimeType && !evidenceSize) return null;
    if (!evidenceUrl || /^data:/i.test(evidenceUrl)) return 'Evidence must be a stored file URL, not raw base64 data.';
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(evidenceMimeType)) return 'Evidence must be a PDF, image, or common Office document.';
    if (Number(evidenceSize) > MAX_EVIDENCE_SIZE) return 'Evidence file cannot exceed 5MB.';
    return null;
};

const canManagerAccessKpi = (manager, kpi) => (
    kpi.createdBy.toString() === manager._id.toString()
);

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
        let query = {};
        // Staff can only read their own assigned KPIs (Server-side scoping)
        if (req.user.role === 'staff') {
            query.assignedTo = req.user._id;
        } else if (req.user.role === 'manager') {
            query.createdBy = req.user._id;
        }
        query.isDeleted = false;
        const kpis = await Kpi.find(query).populate('assignedTo', 'name email department').populate('createdBy', 'name');
        res.json({ success: true, data: kpis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Staff Updates Incremental Progress + Evidential Links
exports.submitProgress = async (req, res) => {
    try {
        const { currentValue, progress, evidenceUrl, evidenceName, evidenceMimeType, evidenceSize, comments } = req.body;
        const evidenceMessage = validateEvidence({ evidenceUrl, evidenceName, evidenceMimeType, evidenceSize });
        if (evidenceMessage) return res.status(400).json({ success: false, message: evidenceMessage });

        const kpi = await Kpi.findOne({ _id: req.params.id, isDeleted: false });

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

        kpi.currentValue = currentValueNumber || 0;
        kpi.progress = progressValue;
        kpi.comments = comments;
        kpi.status = 'submitted';
        kpi.submittedAt = Date.now();

        // If evidence metadata provided, create an Evidence document and attach reference
        if (evidenceUrl) {
            try {
                const evidenceDoc = await Evidence.create({
                    kpi: kpi._id,
                    uploadedBy: req.user._id,
                    name: evidenceName || '',
                    url: evidenceUrl,
                    mimeType: evidenceMimeType || '',
                    size: evidenceSize || 0,
                    storage: 'url'
                });
                kpi.evidenceUrl = evidenceUrl; // keep metadata on KPI for quick access
                kpi.evidenceName = evidenceName || '';
                kpi.evidenceMimeType = evidenceMimeType || '';
                kpi.evidenceSize = evidenceSize || 0;
                kpi.evidenceRef = evidenceDoc._id;
            } catch (e) {
                return res.status(500).json({ success: false, message: 'Failed to store evidence metadata.' });
            }
        }

        await kpi.save();

        // Write immutable transaction into History Logs collection
        await createHistory(kpi, req, 'submitted', {
            value: currentValueNumber || 0,
            progress: progressValue,
            comment: comments,
            evidenceUrl: kpi.evidenceUrl || '',
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

        const kpi = await Kpi.findOne({ _id: req.params.id, isDeleted: false });
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

        kpi.status = status;
        if (status === 'approved') {
            kpi.progress = 100;
            kpi.rejectionReason = '';
        }
        if (status === 'rejected') kpi.rejectionReason = rejectionReason;
        await kpi.save();

        await createHistory(kpi, req, status, { rejectionReason });

        res.json({ success: true, data: kpi });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateKpi = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, isDeleted: false });
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
        const kpi = await Kpi.findOne({ _id: req.params.id, isDeleted: false });
        if (!kpi) return res.status(404).json({ success: false, message: 'KPI not found' });

        const isAssignedStaff = kpi.assignedTo.toString() === req.user._id.toString();
        const isOwnerManager = req.user.role === 'manager' && canManagerAccessKpi(req.user, kpi);
        if (!isAssignedStaff && !isOwnerManager) {
            return res.status(403).json({ success: false, message: 'You cannot view this KPI history.' });
        }

        const history = await KpiHistory.find({ kpi_id: kpi._id })
            .populate('actorId', 'name role department')
            .sort({ recordedAt: -1 });

        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Soft Delete Implementation instead of permanent drops
exports.deleteKpi = async (req, res) => {
    try {
        const kpi = await Kpi.findOne({ _id: req.params.id, isDeleted: false });
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
