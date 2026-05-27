const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
        type: String,
        enum: ['manager', 'staff'],
        default: 'staff'
    },
    department: { type: String, required: true, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, collection: 'user' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
