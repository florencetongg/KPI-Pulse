const express = require('express');
const router = express.Router();
const { createKpi, getKpis, updateKpi, submitProgress, reviewKpi, getKpiHistory, getManagerHistoryFeed, deleteKpi } = require('../controllers/kpiController');
const { protect, authorizeManager } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, authorizeManager, createKpi)
    .get(protect, getKpis);

router.get('/history/feed', protect, getManagerHistoryFeed);

router.route('/:id/submit').put(protect, submitProgress);
router.route('/:id/review').put(protect, authorizeManager, reviewKpi);
router.route('/:id/history').get(protect, getKpiHistory);
router.route('/:id').put(protect, authorizeManager, updateKpi).delete(protect, authorizeManager, deleteKpi);

module.exports = router;
