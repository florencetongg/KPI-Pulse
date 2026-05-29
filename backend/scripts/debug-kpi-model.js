require('dotenv').config();
const mongoose = require('mongoose');
const Kpi = require('../models/kpi');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const id = new mongoose.Types.ObjectId('6a154b1b4f0f9676ea417644');
    console.log('collection', Kpi.collection.collectionName);
    console.log('count all', await Kpi.countDocuments({}));
    console.log('count createdBy', await Kpi.countDocuments({ createdBy: id }));
    console.log('count not deleted', await Kpi.countDocuments({ isDeleted: { $ne: true } }));
    console.log('combined', await Kpi.countDocuments({ createdBy: id, isDeleted: { $ne: true } }));
    await mongoose.disconnect();
})();
