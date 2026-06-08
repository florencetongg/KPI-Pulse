const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { isStrongPassword } = require('../utils/passwordValidation');

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


exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const targetEmail = email.trim().toLowerCase();

        // ----------------------------------------------------------------------
        // EMAIL FORMAT VALIDATION
        // Checks if the email format matches a standard email structure
        // ----------------------------------------------------------------------
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(targetEmail)) {
            return res.status(400).json({ success: false, message: "Invalid email format. Please enter a valid email address." });
        }

        const user = await User.findOne({ email: targetEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "No account registered with this email address." });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const resetUrl = `http://127.0.0.1:5501/pages/reset-password.html?email=${encodeURIComponent(targetEmail)}`;

        const mailOptions = {
            from: `"KPI-Pulse System" <${process.env.EMAIL_USER}>`,
            to: targetEmail,
            subject: '🔒 Reset Your KPI-Pulse Account Password',
            html: `
                <div style="font-family: sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">KPI-Pulse Security Center</h2>
                    <p>We received a request to reset your account password.</p>
                    <p>Click the secure button below to choose a new password:</p>
                    <p style="margin: 35px 0; text-align: center;">
                        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
                    </p>
                    <p style="color: #6b7280; font-size: 0.875rem;">If you did not request this, you can safely ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: "Reset link sent to your inbox." });

    } catch (error) {
        console.error("❌ Nodemailer runtime error:", error);
        return res.status(500).json({ success: false, message: "Internal mail system failure." });
    }
};

// ==========================================
// RESET PASSWORD (With Strict Strength Validation)
// ==========================================
exports.resetPassword = async (req, res) => {
    const { email, password } = req.body;
    

    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required fields." });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 8 characters long, and contain uppercase, lowercase, a number, and a special character." 
            });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: "User account not found." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        user.password = hashedPassword; 
        await user.save();
        
    
        return res.status(200).json({ success: true, message: "Password updated successfully." });

    } catch (error) {
        console.error("❌ Database password update error:", error);
        return res.status(500).json({ success: false, message: "Failed to update security credentials." });
    }
};