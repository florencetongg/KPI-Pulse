const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  kpi: { type: mongoose.Schema.Types.ObjectId, ref: 'Kpi', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, trim: true, required: true },
  url: { type: String, trim: true, required: true }, // Internal file path or reference for stored evidence
  filePath: { type: String, trim: true, default: '' }, // Server-side path used for secure downloads
  mimeType: { type: String, trim: true, default: '' },
  size: { type: Number, min: 0, default: 0 },
  storage: { type: String, enum: ['url', 'gridfs', 'external'], default: 'url' },
  gridFsId: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'evidence' });

evidenceSchema.index({ kpi: 1, uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);
