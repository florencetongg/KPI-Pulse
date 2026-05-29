require('dotenv').config();
const mongoose = require('mongoose');
const KpiHistory = require('../models/kpiHistory');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('KpiHistory collection:', KpiHistory.collection.collectionName);
    console.log('count', await KpiHistory.countDocuments({}));
    await mongoose.disconnect();
})();
