const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registerUser = async (req, res) => {
    try {
        const { fullName, name, email, password, role, department, bio } = req.body;
        const displayName = name || fullName;

        if (!displayName || !email || !password || !department) {
            return res.status(400).json({ success: false, message: 'Name, email, password, and department are required' });
        }
        if (role && !['manager', 'staff'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        // Hash plaintext password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name: displayName, email, password: hashedPassword, role, department, bio
        });

        res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                success: true,
                token: generateToken(user._id),
                user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProfile = async (req, res) => {
    res.json({ success: true, user: req.user });
};

exports.getStaffUsers = async (req, res) => {
    try {
        if (req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Managers only' });
        }

        const query = { role: 'staff', isActive: true };
        if (req.user.department) query.department = req.user.department;

        const staff = await User.find(query)
            .select('name email role department')
            .sort({ name: 1 });

        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.name = req.body.name || user.name;
        user.department = req.body.department || user.department;
        user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
        
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password, salt);
        }

        const updatedUser = await user.save();
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                department: updatedUser.department,
                bio: updatedUser.bio
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
