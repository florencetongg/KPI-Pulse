require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set in backend/.env');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const users = await User.find({}).limit(200).lean();
    if (!users.length) {
      console.log('No users found');
      process.exit(0);
    }
    users.forEach(u => {
      console.log('USER:', u._id.toString(), '-', u.name, '-', u.email, '-', u.role, '-', 'dept:', u.department, 'isActive:', u.isActive);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
