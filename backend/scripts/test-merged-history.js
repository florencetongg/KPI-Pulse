require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { loadMergedHistoryForKpi, loadMergedManagerHistory } = require('../utils/mergedHistory');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const managerId = '6a154b1b4f0f9676ea417644';
    const kpiId = '6a16afa41f233bdd0f87ae96';

    const feed = await loadMergedManagerHistory(managerId);
    console.log('Merged feed count:', feed.length);
    console.log('Approved:', feed.filter(e => e.action === 'approved').length);
    console.log('Unique KPIs:', new Set(feed.map(e => String(e.kpi_id))).size);

    const cycles = await loadMergedHistoryForKpi(kpiId);
    console.log(`\nMerged cycles for ${kpiId}:`, cycles.length);
    console.log('Actions:', [...new Set(cycles.map(c => c.action))].join(', '));

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
