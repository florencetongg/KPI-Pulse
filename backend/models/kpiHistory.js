const mongoose = require('mongoose');

const kpiHistorySchema = new mongoose.Schema({
    kpi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Kpi', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: ['manager', 'staff'], required: true },
    action: {
        type: String,
        enum: ['created', 'updated', 'submitted', 'approved', 'rejected', 'soft-deleted'],
        required: true
    },
    name: { type: String, required: true }, // Snapshotted name at time of change
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'submitted', 'approved', 'rejected', 'deleted'],
        required: true
    },
    target: { type: String, required: true }, // Logs the contextual target info
    value: { type: Number, default: 0 },  // The specific value submitted during this record
    progress: { type: Number, min: 0, max: 100, default: 0 },
    evidenceUrl: { type: String, default: "" },
    evidenceName: { type: String, default: "" },
    evidenceMimeType: { type: String, default: "" },
    evidenceSize: { type: Number, default: 0 },
    evidenceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', default: null },
    rejectionReason: { type: String, default: "" },
    comment: { type: String, default: "" },
    recordedAt: { type: Date, default: Date.now } // Self-managing history log time
}, { collection: 'kpiHistory' });

kpiHistorySchema.index({ kpi_id: 1, recordedAt: -1 });
kpiHistorySchema.index({ staffId: 1, recordedAt: -1 });

module.exports = mongoose.models.KpiHistory || mongoose.model('KpiHistory', kpiHistorySchema);
