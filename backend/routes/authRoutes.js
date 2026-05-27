const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, getStaffUsers, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/staff', protect, getStaffUsers);
router.route('/profile').get(protect, getProfile).put(protect, updateProfile);

module.exports = router;
