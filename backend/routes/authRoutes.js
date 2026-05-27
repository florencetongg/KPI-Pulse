const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, getStaffUsers, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/staff', protect, getStaffUsers);
router.route('/profile').get(protect, getProfile).put(protect, updateProfile);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
