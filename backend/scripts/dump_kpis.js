require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
// Ensure User model is registered before populating references
require('../models/user');
const Kpi = require('../models/kpi');

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set in backend/.env');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const kpis = await Kpi.find({}).limit(200).populate('assignedTo', 'name department').populate('createdBy', 'name').lean();
    if (!kpis.length) {
      console.log('No KPI documents found');
      process.exit(0);
    }
    kpis.forEach(k => {
      console.log('KPI:', k._id.toString());
      console.log('  name:', k.name);
      console.log('  assignedTo:', k.assignedTo ? (k.assignedTo._id ? k.assignedTo._id.toString() + ' (' + k.assignedTo.name + ')' : k.assignedTo) : null);
      console.log('  createdBy:', k.createdBy ? (k.createdBy._id ? k.createdBy._id.toString() + ' (' + k.createdBy.name + ')' : k.createdBy) : null);
      console.log('  status:', k.status, 'isDeleted:', k.isDeleted);
      console.log('  dueDate:', k.dueDate);
      console.log('---');
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
