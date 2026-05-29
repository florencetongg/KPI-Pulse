const express = require('express');
const router = express.Router();
const { getKpiHistoryFeed, getKpiHistoryByKpiId, getKpiHistoryCycles } = require('../controllers/kpiRecordController');
const { protect } = require('../middleware/authMiddleware');

router.get('/feed', protect, getKpiHistoryFeed);
router.get('/', protect, getKpiHistoryByKpiId);
router.get('/:kpiId/cycles', protect, getKpiHistoryCycles);

module.exports = router;
