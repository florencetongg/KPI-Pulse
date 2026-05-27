const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Verify standard JWT session
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user || req.user.isActive === false) {
                return res.status(401).json({ success: false, message: 'Not authorized, user inactive or missing' });
            }
            return next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
        }
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Enforce Manager Role Validation
const authorizeManager = (req, res, next) => {
    if (req.user && req.user.role === 'manager') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access denied: Managers only' });
    }
};

module.exports = { protect, authorizeManager };
