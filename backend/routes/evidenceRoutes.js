const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadEvidence');
const { uploadEvidence, getEvidence, downloadEvidence } = require('../controllers/evidenceController');

// Upload endpoint: accepts multipart/form-data with field 'file'
router.post('/upload', protect, (req, res, next) => {
	// run multer and return JSON errors for common upload problems
	upload.single('file')(req, res, function (err) {
		if (err) return res.status(400).json({ success: false, message: err.message });
		return next();
	});
}, uploadEvidence);
router.get('/:id/download', protect, downloadEvidence);
router.get('/:id', protect, getEvidence);

module.exports = router;
