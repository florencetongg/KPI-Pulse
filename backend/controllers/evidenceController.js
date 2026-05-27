const path = require('path');
const fs = require('fs');
const Evidence = require('../models/evidence');

const DOWNLOAD_BASE = '/api/evidence';

function buildDownloadUrl(id) {
  return `${DOWNLOAD_BASE}/${id}/download`;
}

function getEvidenceFilePath(evidence) {
  if (!evidence || !evidence.filePath) return null;
  const relativePath = evidence.filePath;
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) return null;

  const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'evidence');
  const filePath = path.resolve(__dirname, '..', relativePath);
  if (!filePath.startsWith(uploadsDir + path.sep)) return null;
  return filePath;
}

function canAccessEvidence(user, evidence) {
  if (!user || !evidence) return false;
  const userId = String(user._id || '');
  if (String(evidence.uploadedBy || '') === userId) return true;
  if (user.role === 'manager' || user.role === 'admin') return true;

  const kpi = evidence.kpi;
  if (!kpi) return false;

  if (user.role === 'staff' && String(kpi.assignedTo || '') === userId) return true;
  return false;
}

// POST /api/evidence/upload
exports.uploadEvidence = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const kpiId = req.body.kpi || req.body.kpiId || null;
    const storagePath = path.join('uploads', 'evidence', req.file.filename);

    const doc = await Evidence.create({
      kpi: kpiId || null,
      uploadedBy: req.user ? req.user._id : null,
      name: req.file.originalname,
      url: storagePath,
      filePath: storagePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storage: 'url',
      createdAt: Date.now()
    });

    return res.json({
      success: true,
      data: {
        id: doc._id,
        downloadUrl: buildDownloadUrl(doc._id),
        name: doc.name,
        mimeType: doc.mimeType,
        size: doc.size
      }
    });
  } catch (err) {
    try { if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
};

// GET /api/evidence/:id
exports.getEvidence = async (req, res) => {
  try {
    const doc = await Evidence.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate({ path: 'kpi', select: 'assignedTo createdBy' });

    if (!doc) return res.status(404).json({ success: false, message: 'Evidence not found' });
    if (!canAccessEvidence(req.user, doc)) {
      return res.status(403).json({ success: false, message: 'Access denied to this evidence' });
    }

    const data = {
      id: doc._id,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      downloadUrl: buildDownloadUrl(doc._id),
      uploadedBy: doc.uploadedBy,
      kpi: doc.kpi,
      createdAt: doc.createdAt
    };

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/evidence/:id/download
exports.downloadEvidence = async (req, res) => {
  try {
    const doc = await Evidence.findById(req.params.id).populate({ path: 'kpi', select: 'assignedTo createdBy' });
    if (!doc) return res.status(404).json({ success: false, message: 'Evidence not found' });
    if (!canAccessEvidence(req.user, doc)) {
      return res.status(403).json({ success: false, message: 'Access denied to this evidence' });
    }

    const filePath = getEvidenceFilePath(doc);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Evidence file not found' });
    }

    return res.download(filePath, doc.name, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to download evidence file' });
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
