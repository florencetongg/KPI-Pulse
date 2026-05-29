const mongoose = require('mongoose');

const kpiRecordSchema = new mongoose.Schema({
    kpiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kpi', required: true },
    kpiTitle: { type: String, required: true, trim: true, maxlength: 120 },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    cycleLabel: { type: String, required: true, trim: true, maxlength: 40 },
    targetValue: { type: Number, required: true, min: 0 },
    actualValue: { type: Number, default: 0, min: 0 },
    evidenceUrl: { type: String, trim: true, maxlength: 500, default: '' },
    deadline: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, required: true },
    status: { type: String, enum: ['approved'], default: 'approved' },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
}, {
    timestamps: true,
    collection: 'kpi_cycle_records',
});

kpiRecordSchema.index({ kpiId: 1, managerId: 1, cycleLabel: 1 });

module.exports = mongoose.models.KpiRecord || mongoose.model('KpiRecord', kpiRecordSchema);
