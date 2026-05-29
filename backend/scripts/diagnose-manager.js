require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');
const { loadMergedHistoryForKpi, loadMergedManagerHistory } = require('../utils/mergedHistory');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const manager = await User.findOne({ email: 'alex.manager@kpipro.com' }).lean();
    console.log('Manager:', manager?.email, manager?._id);

    const kpirecords = await db.collection('kpirecords').find({ createdBy: manager._id, isDeleted: { $ne: true } }).toArray();
    const legacyKpi = await db.collection('kpi').find({ createdBy: manager._id, isDeleted: { $ne: true } }).toArray();
    console.log('kpirecords for manager:', kpirecords.length, kpirecords.map(k => k.name));
    console.log('legacy kpi for manager:', legacyKpi.length, legacyKpi.map(k => k.name));

    const feed = await loadMergedManagerHistory(manager._id);
    console.log('Merged feed:', feed.length, 'unique KPIs:', new Set(feed.map(e => String(e.kpi_id))).size);

    const sampleId = kpirecords[0]?._id || feed[0]?.kpi_id;
    if (sampleId) {
        const cycles = await loadMergedHistoryForKpi(sampleId);
        console.log(`Cycles for ${sampleId}:`, cycles.length);
        console.log('Sample entry fields:', cycles[0] ? Object.keys(cycles[0]) : 'none');
        console.log('managerId on entries:', [...new Set(cycles.map(c => String(c.managerId || '')))]);
        console.log('actorId/role:', cycles.map(c => ({ action: c.action, actorRole: c.actorRole, actorId: String(c.actorId || '') })));
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
