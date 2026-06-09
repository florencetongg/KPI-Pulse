const express = require('express');
const router = express.Router();
const { getKpiRecordsByKpiId, getManagerKpiRecordsFeed, getStaffKpiRecords } = require('../controllers/kpiRecordController');
const { protect } = require('../middleware/authMiddleware');

router.get('/feed', protect, getManagerKpiRecordsFeed);
router.get('/my', protect, getStaffKpiRecords);
router.get('/:kpiId', protect, getKpiRecordsByKpiId);

module.exports = router;
